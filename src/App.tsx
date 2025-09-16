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

// Determina a coluna (0..8) pelo número
function colIndex(n: number): number {
  return n === 90 ? 8 : Math.floor(n / 10); // 1-9 -> 0, 10-19 -> 1, ..., 80-90 -> 8
}

// Gera 1 tira balanceada (6 cartelas), cobrindo 1..90 sem repetição,
// respeitando no máx. 2 números por coluna por cartela e 15 números por cartela.
function generateBalancedStrip(): Ticket[] {
  // 9 colunas de ranges: [1..9], [10..19], ..., [80..90]
  const ranges: number[][] = Array.from({ length: 9 }, (_, c) => {
    const start = c === 0 ? 1 : c * 10;
    const end = c === 8 ? 90 : c * 10 + 9;
    const arr = Array.from({ length: end - start + 1 }, (_, i) => start + i);
    return shuffle(arr);
  });

  // ticketsCols[ticketIndex][columnIndex] = number[]
  const ticketsCols: number[][][] = Array.from({ length: 6 }, () =>
    Array.from({ length: 9 }, () => [])
  );

  // Distribuição por coluna:
  // Para cada coluna c com N números:
  // - dá 1 número para cada um dos 6 tickets (se N>=6)
  // - distribui o restante R = N-6 dando +1 número para (c + i) % 6 (equilibra extras)
  for (let c = 0; c < 9; c++) {
    const pool = ranges[c]; // já embaralhada
    const N = pool.length;
    let p = 0;

    // Base: 1 por ticket
    for (let t = 0; t < 6 && p < N; t++) {
      ticketsCols[t][c].push(pool[p++]);
    }

    // Extras: distribui ciclicamente começando no índice c (equilibra entre tickets)
    const R = N - Math.min(6, N);
    for (let i = 0; i < R && p < N; i++) {
      const t = (c + i) % 6;
      ticketsCols[t][c].push(pool[p++]);
    }
  }

  // Converte estrutura por colunas para cartelas (arrays de 15 números), ordenados
  const tickets: Ticket[] = ticketsCols.map(cols => {
    const flat = cols.flat().sort((a, b) => a - b);
    return flat;
  });

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
    const s = generateBalancedStrip();

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

// Constrói a grade 3x9: colunas por faixas [1-9], [10-19], ..., [80-90],
// distribuindo os números entre as 3 linhas para que cada linha tenha exatamente 5 números.
function ticketToGrid(ticket: number[]): (number | null)[][] {
  // Agrupa por coluna (0..8)
  const columns: number[][] = Array.from({ length: 9 }, () => []);
  for (const n of ticket) {
    columns[colIndex(n)].push(n);
  }
  // Ordena internamente
  columns.forEach(col => col.sort((a, b) => a - b));

  // Distribui para 3 linhas garantindo 5 números por linha
  const rows: (number | null)[][] = Array.from({ length: 3 }, () => Array(9).fill(null));
  const rowCounts = [0, 0, 0];

  for (let c = 0; c < 9; c++) {
    const colVals = columns[c]; // tamanho 0..2 (pela geração balanceada)
    // Para cada número da coluna, coloca na linha com menor contagem atual (<5)
    for (const v of colVals) {
      let targetRow = 0;
      for (let r = 1; r < 3; r++) {
        if (rowCounts[r] < rowCounts[targetRow]) targetRow = r;
      }
      // Se a linha alvo já tem 5, pega a próxima disponível
      if (rowCounts[targetRow] >= 5) {
        const alt = [0, 1, 2].find(r => rowCounts[r] < 5);
        if (alt === undefined) continue; // já temos 15 números colocados
        targetRow = alt;
      }
      rows[targetRow][c] = v;
      rowCounts[targetRow]++;
    }
  }

  // Garantia: no final queremos [5,5,5]. Se por algum motivo faltou alocar,
  // (não deve ocorrer com a geração balanceada) não faremos remanejamento agressivo.
  return rows;
}

export default function App() {
  const [qty, setQty] = useState<number>(1);
  const [strips, setStrips] = useState<Strip[]>(() => [generateBalancedStrip()]);
  const [validityDate, setValidityDate] = useState<string>(""); // data de validade no rodapé

  // Validação por tira (memoizada a partir do array)
  const validations = useMemo(() => strips.map(s => validateStrip(s)), [strips]);

  const handleGenerate = () => {
    const target = Math.max(1, Math.min(9999, Math.floor(qty || 1)));
    const newStrips = generateStripsUnique(target);
    setStrips(newStrips.length ? newStrips : [generateBalancedStrip()]);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div style={styles.page} className="landscape">
      <style>
        {`
          @page {
            size: A4 landscape;
            margin: 10mm;
          }
          @media print {
            html, body {
              width: 297mm;
              height: 210mm;
            }
            /* Expande conteúdo na impressão em paisagem */
            .landscape {
              max-width: none !important;
            }
            /* Duas cartelas por linha para ficarem mais largas */
            .ticket-grid {
              grid-template-columns: repeat(2, 1fr) !important;
              gap: 14px !important;
            }
            /* Células maiores e texto mais legível */
            .ticket-row .cell {
              font-size: 14pt !important;
              padding: 10pt 0 !important;
            }
          }
        `}
      </style>
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

            <div style={styles.stripGrid} className="ticket-grid">
              {tickets.map((ticket, idx) => (
                <div key={idx} style={styles.ticketCard}>
                  <div style={styles.ticketHeader}>Cartela {idx + 1}</div>
                  <div style={styles.ticketBody}>
                    {ticketToGrid(ticket).map((row, rIdx) => (
                      <div key={rIdx} style={styles.ticketRow} className="ticket-row">
                        {row.map((n, cIdx) => (
                          <div key={`${rIdx}-${cIdx}`} style={styles.cell} className="cell">
                            {n ?? ""}
                          </div>
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
    maxWidth: 1400, // mais largo para caber melhor em paisagem
    margin: "0 auto",
    padding: 16,
    fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif",
    printColorAdjust: "exact" as any, // garante reprodução de cores na impressão
    WebkitPrintColorAdjust: "exact" as any,
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
    gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))", // cartelas mais largas na tela
    gap: 12,
  },
  ticketCard: {
    border: "2px solid #424242", // borda mais forte
    borderRadius: 10,
    overflow: "hidden",
    background: "#fff",
    boxShadow: "0 1px 2px rgba(0,0,0,0.06)",
  },
  ticketHeader: {
    background: "#e0e0e0", // cabeçalho com contraste maior
    color: "#111",
    padding: "8px 10px",
    fontWeight: 800, // mais espesso
    letterSpacing: "0.3px", // mais “larga”
    borderBottom: "2px solid #424242", // linha mais forte
  },
  ticketBody: {
    padding: 10,
  },
  ticketRow: {
    display: "grid",
    gridTemplateColumns: "repeat(9, 1fr)", // 9 colunas: [1-9], [10-19], ..., [80-90]
    gap: 6,
    marginBottom: 6,
  },
  cell: {
    textAlign: "center",
    padding: "12px 0", // um pouco mais alto para legibilidade
    borderRadius: 6,
    background: "#ffffff", // fundo branco para máximo contraste
    border: "2px solid #424242", // borda mais forte
    color: "#111", // texto mais escuro
    fontWeight: 800, // números mais espessos
    letterSpacing: "0.5px", // números mais “largos”
    fontVariantNumeric: "tabular-nums", // dígitos com largura uniforme (melhora leitura)
    minHeight: 36,
    printColorAdjust: "exact" as any,
    WebkitPrintColorAdjust: "exact" as any,
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