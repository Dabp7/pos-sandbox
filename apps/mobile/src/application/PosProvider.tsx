import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { AppState, Platform } from "react-native";
import * as Crypto from "expo-crypto";
import { catalog, type Sale } from "../../../../packages/contracts/sale";
import { buildSale, type CartLine } from "../domain/money";
import { openStore } from "../storage/expo";
import type { SaleStore, SavedSale } from "../storage/store";
import {
  selectPrinter,
  SimulatedPaymentDevice,
  type PaymentState,
} from "../devices/simulators";
import { synchronize } from "../sync/synchronize";

type PosState = {
  cart: CartLine[];
  add: (id: string) => void;
  remove: (id: string) => void;
  discount: number;
  setDiscount: (value: number) => void;
  sales: SavedSale[];
  loading: boolean;
  busy: boolean;
  message: string;
  error: string;
  confirm: () => Promise<void>;
  refresh: () => Promise<void>;
  sync: () => Promise<void>;
  print: (sale: Sale, copy: boolean) => Promise<void>;
  retry: (id: string) => Promise<void>;
  offline: boolean;
  setOffline: (value: boolean) => void;
  drop: boolean;
  setDrop: (value: boolean) => void;
  apiUrl: string;
  setApiUrl: (value: string) => void;
  paymentMode: PaymentState;
  setPaymentMode: (value: PaymentState) => void;
  uncertain: boolean;
  failPrinter: boolean;
  setFailPrinter: (value: boolean) => void;
  manufacturer: string;
  setManufacturer: (value: string) => void;
};
const Context = createContext<PosState | null>(null);
export function PosProvider({ children }: { children: ReactNode }) {
  const store = useRef<SaleStore | null>(null);
  const payment = useRef(new SimulatedPaymentDevice());
  const draftId = useRef(Crypto.randomUUID());
  const locked = useRef(false);
  const syncing = useRef(false);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [discount, setDiscount] = useState(0);
  const [sales, setSales] = useState<SavedSale[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(
    "Listo para una venta de demostración",
  );
  const [error, setError] = useState("");
  const [offline, setOffline] = useState(false);
  const [drop, setDrop] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const [paymentMode, setPaymentMode] = useState<PaymentState>("approved");
  const [failPrinter, setFailPrinter] = useState(false);
  const [manufacturer, setManufacturer] = useState("Topwise");
  const [apiUrl, setApiUrl] = useState(
    process.env.EXPO_PUBLIC_API_BASE_URL ??
      (Platform.OS === "web"
        ? "http://localhost:4310"
        : "http://10.0.2.2:4310"),
  );
  const refresh = useCallback(async () => {
    if (store.current) setSales(await store.current.list());
  }, []);
  const sync = useCallback(async () => {
    if (!store.current || syncing.current || offline) return;
    syncing.current = true;
    try {
      if (!/^https?:\/\//.test(apiUrl))
        throw new Error("La URL de API debe empezar con http:// o https://");
      const count = await synchronize(
        store.current,
        apiUrl.replace(/\/$/, ""),
        "mobile-worker",
        fetch,
        drop,
      );
      if (count) setMessage(`${count} venta(s) confirmadas por el servidor`);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo sincronizar");
    } finally {
      syncing.current = false;
    }
  }, [apiUrl, offline, drop, refresh]);
  useEffect(() => {
    let alive = true;
    openStore()
      .then(async (result) => {
        if (!alive) return;
        store.current = result;
        for (const product of catalog)
          await result.db.run(
            "INSERT OR IGNORE INTO products(id,name,price_minor,currency) VALUES(?,?,?,?)",
            [product.id, product.name, product.priceMinor, product.currency],
          );
        await refresh();
        if (alive) setLoading(false);
      })
      .catch((e) => {
        if (alive) {
          setError(`No se abrió SQLite: ${String(e)}`);
          setLoading(false);
        }
      });
    return () => {
      alive = false;
    };
  }, [refresh]);
  useEffect(() => {
    const timer = setInterval(() => {
      void sync();
    }, 10_000);
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") void sync();
    });
    void sync();
    return () => {
      clearInterval(timer);
      subscription.remove();
    };
  }, [sync, loading]);
  async function print(sale: Sale, copy: boolean) {
    const printer = selectPrinter(manufacturer);
    printer.failNext = failPrinter;
    setFailPrinter(false);
    try {
      const ticket = await printer.print(sale, copy);
      await store.current?.recordPrint(sale.id, "printed", copy);
      setMessage(ticket);
      setError("");
    } catch (e) {
      const reason = e instanceof Error ? e.message : "Error de impresión";
      await store.current?.recordPrint(sale.id, reason, copy);
      setError(
        `${reason}. La venta está guardada; puede reimprimirla desde Historial.`,
      );
    }
    await refresh();
  }
  async function confirm() {
    if (locked.current || !store.current || !cart.length) return;
    locked.current = true;
    setBusy(true);
    setError("");
    try {
      payment.current.mode = paymentMode;
      const snapshot = cart.map((line) => ({
        ...line,
        discountBps: discount * 100,
      }));
      const preview = buildSale(
        draftId.current,
        snapshot,
        `SIM-${draftId.current}`,
      );
      const result = uncertain
        ? await payment.current.getStatus(draftId.current)
        : await payment.current.authorize(draftId.current, preview.totalMinor);
      if (result.state === "uncertain") {
        setUncertain(true);
        setMessage(
          "Respuesta de pago incierta. Consulte el mismo intento; no se emitió otra autorización.",
        );
        return;
      }
      if (result.state === "declined") {
        draftId.current = Crypto.randomUUID();
        setUncertain(false);
        throw new Error("Pago simulado rechazado. No se guardó una venta.");
      }
      const sale = { ...preview, paymentReference: result.reference };
      await store.current.save(sale);
      setCart([]);
      setDiscount(0);
      setUncertain(false);
      draftId.current = Crypto.randomUUID();
      setMessage(
        "Venta guardada en SQLite. Pendiente de confirmación del servidor.",
      );
      await refresh();
      await print(sale, false);
      void sync();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo guardar la venta");
    } finally {
      locked.current = false;
      setBusy(false);
    }
  }
  function add(id: string) {
    if (uncertain || locked.current) return;
    const product = catalog.find((item) => item.id === id)!;
    setCart((previous) => {
      const found = previous.find((line) => line.product.id === id);
      if (found)
        return previous.map((line) =>
          line.product.id === id
            ? { ...line, quantity: Math.min(999, line.quantity + 1) }
            : line,
        );
      return [...previous, { product, quantity: 1, discountBps: 0 }];
    });
  }
  function remove(id: string) {
    if (!uncertain && !locked.current)
      setCart((previous) => previous.filter((line) => line.product.id !== id));
  }
  async function retry(id: string) {
    await store.current?.retry(id);
    await refresh();
    await sync();
  }
  return (
    <Context.Provider
      value={{
        cart,
        add,
        remove,
        discount,
        setDiscount: (value) => {
          if (!uncertain) setDiscount(value);
        },
        sales,
        loading,
        busy,
        message,
        error,
        confirm,
        refresh,
        sync,
        print,
        retry,
        offline,
        setOffline,
        drop,
        setDrop,
        apiUrl,
        setApiUrl,
        paymentMode,
        setPaymentMode,
        uncertain,
        failPrinter,
        setFailPrinter,
        manufacturer,
        setManufacturer,
      }}
    >
      {children}
    </Context.Provider>
  );
}
export function usePos() {
  const value = useContext(Context);
  if (!value) throw new Error("PosProvider requerido");
  return value;
}
