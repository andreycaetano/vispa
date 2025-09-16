import { useMemo, useState } from "react";

type Ticket = number[]; // 15 números
type Strip = Ticket[];  // 6 cartelas

function shuffle<T>(arr: T[]): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function generateStrip(): Ticket[] {
  // Gera 1..90, embaralha e divide em 6 cartelas de 15
  const nums = Array.from({ length: 90 }, (_, i) => i + 1);
  const shuffled = shuffle(nums);
  const tickets: Ticket[] = [];
  for (let i = 0; i < 6; i++) {
    const chunk = shuffled.slice(i * 15, i * 15 + 15).sort((a, b) => a - b);
    tickets.push(chunk);
  }
  return tickets;
}

// Assinatura canônica de uma cartela (ordem crescente já garantida)
function ticketSignature(ticket: Ticket): string {
  // Se no futuro a geração mudar, a assinatura continua canônica
  const sorted = ticket.slice().sort((a, b) => a - b);
  return sorted.join(",");
}

// Gera N tiras, garantindo que TODAS as cartelas do lote sejam únicas
function generateStripsUnique(count: number): Strip[] {
  const strips: Strip[] = [];
  const seen = new Set<string>(); // assinaturas de todas as cartelas do lote
  let guard = 0;
  const maxAttempts = Math.max(2000, count * 200); // margem generosa para evitar loop infinito

  while (strips.length < count && guard++ < maxAttempts) {
    const s = generateStrip();

    // Verifica se alguma cartela desta tira já foi vista no lote
    const sigs = s.map(ticketSignature);
    const hasDupInBatch = sigs.some(sig => seen.has(sig));
    if (hasDupInBatch) {
      continue; // descarta esta tira e tenta novamente
    }

    // Aceita tira e registra assinaturas
    sigs.forEach(sig => seen.add(sig));
    strips.push(s);
  }

  if (strips.length < count) {
    // Em caso extremamente improvável de não conseguir no limite de tentativas
    console.warn("Não foi possível gerar todas as tiras únicas dentro do limite de tentativas.");
  }

  return strips;
}

function validateStrip(tickets: Ticket[]): { ok: boolean; missing: number[]; duplicates: number[] } {
  const all = tickets.flat();
  const seen = new Map<number, number>();
  for (const n of all) seen.set(n, (seen.get(n) ?? 0) + 1);

  const missing: number[] = [];
  const duplicates: number[] = [];
  for (let n = 1; n <= 90; n++) {
    const count = seen.get(n) ?? 0;
    if (count === 0) missing.push(n);
    if (count > 1) duplicates.push(n);
  }
  const ok = missing.length === 0 && duplicates.length === 0 && all.length === 90;
  return { ok, missing, duplicates };
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

// Formata "YYYY-MM-DD" para "DD/MM/YYYY"
function formatDate(brDateIso: string): string {
  if (!brDateIso) return "";
  const [y, m, d] = brDateIso.split("-");
  if (!y || !m || !d) return brDateIso;
  return `${d}/${m}/${y}`;
}

export default function App() {
  const [qty, setQty] = useState<number>(1);
  const [strips, setStrips] = useState<Strip[]>(() => [generateStrip()]);
  const [validityDate, setValidityDate] = useState<string>(""); // data de validade no rodapé

  // Validação por tira (memoizada a partir do array)
  const validations = useMemo(() => strips.map(s => validateStrip(s)), [strips]);

  const handleGenerate = () => {
    const target = Math.max(1, Math.min(9999, Math.floor(qty || 1)));
    const newStrips = generateStripsUnique(target);
    setStrips(newStrips.length ? newStrips : [generateStrip()]);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div style={styles.page}>
      <h1 style={{ marginBottom: 8 }}>Gerador de Cartelas (1 a 90)</h1>
      <p style={{ marginTop: 0, color: "#555" }}>
        Cada tira contém 6 cartelas de 15 números. A união das 6 cartelas cobre 1..90 sem repetição.
      </p>

      <div style={styles.actions}>
        <label style={{ fontWeight: 600 }} htmlFor="qty">Quantidade de tiras:</label>
        <input
          id="qty"
          type="number"
          min={1}
          max={9999}
          value={qty}
          onChange={(e) => setQty(Number(e.target.value))}
          style={styles.input}
        />
        <label style={{ fontWeight: 600 }} htmlFor="validity">Validade:</label>
        <input
          id="validity"
          type="date"
          value={validityDate}
          onChange={(e) => setValidityDate(e.target.value)}
          style={styles.input}
        />
        <button onClick={handleGenerate} style={styles.button}>Gerar {qty} {qty === 1 ? "Tira" : "Tiras"}</button>
        <button onClick={handlePrint} style={{ ...styles.button, marginLeft: 8, background: "#2e7d32", borderColor: "#2e7d32" }}>
          Imprimir
        </button>
      </div>

      {strips.map((tickets, stripIdx) => {
        const validation = validations[stripIdx];
        return (
          <div key={stripIdx} style={stripIdx > 0 ? styles.stripContainerWithBreak : styles.stripContainer}>
            <div style={styles.stripHeaderRow}>
              <h2 style={{ margin: 0 }}>Tira {stripIdx + 1}</h2>
              <span
                style={{
                  padding: "6px 10px",
                  borderRadius: 6,
                  background: validation.ok ? "#e8f5e9" : "#ffebee",
                  color: validation.ok ? "#1b5e20" : "#b71c1c",
                  fontWeight: 600,
                }}
                title={
                  validation.ok
                    ? "Tira válida: contém todos os números de 1 a 90 sem repetição."
                    : `Há inconsistências: faltando [${validation.missing.join(", ")}], duplicados [${validation.duplicates.join(", ")}]`
                }
              >
                {validation.ok ? "Válida" : "Inválida"}
              </span>
            </div>

            <div style={styles.stripGrid}>
              {tickets.map((ticket, idx) => (
                <div key={idx} style={styles.ticketCard}>
                  <div style={styles.ticketHeader}>Cartela {idx + 1}</div>
                  <div style={styles.ticketBody}>
                    {chunk(ticket, 5).map((row, rIdx) => (
                      <div key={rIdx} style={styles.ticketRow}>
                        {row.map((n) => (
                          <div key={n} style={styles.cell}>{n}</div>
                        ))}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {/* Rodapé com data de validade */}
            {validityDate && (
              <div style={styles.stripFooter}>
                Validade: {formatDate(validityDate)}
              </div>
            )}

            {!validation.ok && (
              <div style={{ marginTop: 12, color: "#b71c1c", pageBreakInside: "avoid" }}>
                <div><strong>Faltando:</strong> {validation.missing.join(", ") || "-"}</div>
                <div><strong>Duplicados:</strong> {validation.duplicates.join(", ") || "-"}</div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    maxWidth: 1100,
    margin: "0 auto",
    padding: 16,
    fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif",
  },
  actions: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    margin: "12px 0 20px",
    printColorAdjust: "exact" as any,
  },
  input: {
    width: 160,
    padding: "8px 10px",
    borderRadius: 8,
    border: "1px solid #ccc",
    outline: "none",
  },
  button: {
    padding: "10px 14px",
    borderRadius: 8,
    border: "1px solid #1976d2",
    background: "#1976d2",
    color: "#fff",
    cursor: "pointer",
    fontWeight: 600,
  },
  stripContainer: {
    pageBreakInside: "avoid",
  },
  stripContainerWithBreak: {
    marginTop: 16,
    pageBreakBefore: "always",
    pageBreakInside: "avoid",
  },
  stripHeaderRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    margin: "4px 0 10px",
  },
  stripGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
    gap: 12,
  },
  ticketCard: {
    border: "1px solid #e0e0e0",
    borderRadius: 10,
    overflow: "hidden",
    background: "#fff",
    boxShadow: "0 1px 2px rgba(0,0,0,0.06)",
  },
  ticketHeader: {
    background: "#f5f5f5",
    padding: "8px 10px",
    fontWeight: 700,
    borderBottom: "1px solid #e0e0e0",
  },
  ticketBody: {
    padding: 10,
  },
  ticketRow: {
    display: "grid",
    gridTemplateColumns: "repeat(5, 1fr)",
    gap: 6,
    marginBottom: 6,
  },
  cell: {
    textAlign: "center",
    padding: "10px 0",
    borderRadius: 6,
    background: "#fafafa",
    border: "1px solid #e0e0e0",
    fontWeight: 600,
  },
  stripFooter: {
    marginTop: 12,
    paddingTop: 8,
    borderTop: "1px solid #e0e0e0",
    color: "#424242",
    fontSize: 12,
    display: "flex",
    justifyContent: "flex-end",
    pageBreakInside: "avoid",
  },
};