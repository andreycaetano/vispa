import { useMemo, useState, useEffect } from "react";

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

// Gera 'count' códigos únicos de 4 dígitos (string), sem repetição no lote
function generateUniqueHashes(count: number, digits = 4): string[] {
  const max = Math.pow(10, digits);
  if (count > max) {
    throw new Error(`Não é possível gerar ${count} hashes únicos de ${digits} dígitos.`);
  }
  const set = new Set<string>();
  while (set.size < count) {
    const n = Math.floor(Math.random() * max);
    set.add(n.toString().padStart(digits, "0"));
  }
  return Array.from(set);
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
  const [stripValidity, setStripValidity] = useState<string[]>([]); // data “congelada” por tira
  const [stripHashes, setStripHashes] = useState<string[][]>([]); // hashes por tira/cartela

  // Validação por tira (memoizada a partir do array)
  const validations = useMemo(() => strips.map(s => validateStrip(s)), [strips]);

      // Gera hashes e validações "congeladas" na primeira carga e sempre que as tiras mudarem,
          // garantindo que a tela inicial já venha com hash e validade por tira.
              useEffect(() => {
                   if (!strips.length) return;
                    // Sincroniza validade "congelada" se necessário (não reagimos a mudanças do input de validade)
                        if (stripValidity.length !== strips.length) {
                          setStripValidity(Array(strips.length).fill(validityDate));
                        }
                    // Gera hashes se a quantidade atual não bate com o total de cartelas
                        const totalTickets = strips.reduce((acc, s) => acc + s.length, 0);
                    const currentCount = stripHashes.reduce((acc, s) => acc + s.length, 0);
                    if (currentCount !== totalTickets && totalTickets > 0) {
                          const batchHashes = generateUniqueHashes(totalTickets, 4);
                          const distributed: string[][] = [];
                          let cursor = 0;
                          for (const s of strips) {
                                const slice = batchHashes.slice(cursor, cursor + s.length);
                                distributed.push(slice);
                                cursor += s.length;
                              }
                          setStripHashes(distributed);
                        }
                  }, [strips]); // intencionalmente não depende de validityDate

  const handleGenerate = () => {
    const target = Math.max(1, Math.min(9999, Math.floor(qty || 1)));
    const newStrips = generateStripsUnique(target);
    const acceptedStrips = newStrips.length ? newStrips : [generateBalancedStrip()];
    setStrips(acceptedStrips);
    // congela a validade para as tiras geradas agora
    const frozen = acceptedStrips.length;
    setStripValidity(Array(frozen).fill(validityDate));

    // Gera hashes únicos (4 dígitos) sem repetição no pack inteiro (todas as cartelas de todas as tiras deste lote)
    const totalTickets = acceptedStrips.reduce((acc, s) => acc + s.length, 0);
    const batchHashes = generateUniqueHashes(totalTickets, 4);

    // Distribui os hashes no mesmo ordenamento das cartelas
    const distributed: string[][] = [];
    let cursor = 0;
    for (const s of acceptedStrips) {
      const slice = batchHashes.slice(cursor, cursor + s.length);
      distributed.push(slice);
      cursor += s.length;
    }
    setStripHashes(distributed);
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
            margin: 5mm; /* antes 10mm: mais largura útil */
          }
          @media print {
            html, body {
              width: 297mm;
              height: 210mm;
            }
            /* Consistência de medida e evita cortar a última coluna */
            *, *::before, *::after {
              box-sizing: border-box !important;
            }
            /* Usar toda a largura disponível no print */
            .landscape {
              max-width: none !important;
              padding: 0 !important;
            }
            /* Esconde cabeçalho/rodapé e controles no print */
            .strip-header,
            .strip-footer,
            .no-print {
              display: none !important;
            }
            /* Cabeçalho dentro da cartela (compacto) */
            .ticket-header {
              padding: 1.2mm 1.6mm !important;
              border-bottom: 0.4mm solid #424242 !important;
              background: #e0e0e0 !important;
              font-size: 3.2mm !important;
              line-height: 1.1 !important;
            }
            .ticket-header .establishment {
              font-weight: 800 !important;
              letter-spacing: 0.2mm !important;
            }
            /* 2 colunas x 3 linhas, com gaps menores para ampliar as cartelas */
            .ticket-grid {
              grid-template-columns: repeat(2, 1fr) !important;
              grid-template-rows: repeat(3, 1fr) !important;
              gap: 1mm !important;              /* antes 1.2mm */
              width: 100% !important;
              max-width: 100% !important; /* garante que não haja contração */
              inline-size: 100vw !important; 
              height: calc(100vh - 8mm) !important; /* reserva espaço para o rodapé fixo */
              align-content: stretch !important;
              align-items: stretch !important;
            }
            /* Cartela ocupa toda a célula, sem cortes */
            .ticket-card {
              width: 100% !important;
              height: 100% !important;
              display: flex !important;
              flex-direction: column !important;
              align-items: stretch !important;
              justify-content: stretch !important;
              border: 0.8mm solid #424242 !important; /* antes 1mm */
              border-radius: 2mm !important;
              overflow: visible !important;     /* não corta a coluna final */
              background: #fff !important;
            }
            /* Centraliza verticalmente as linhas dentro da cartela */
            .ticket-body {
              width: 100% !important;
              max-width: 100% !important;
              height: 100% !important;
              padding: 1.6mm !important;        /* antes 1.8mm */
              display: flex !important;
              flex-direction: column !important;
              justify-content: center !important;
            }
            /* Gaps mais compactos dentro da cartela */
            .ticket-row {
              gap: 1mm !important;            /* antes 2mm */
              margin-bottom: 1.6mm !important;
            }
            .ticket-row:last-child {
              margin-bottom: 0 !important;
            }
            /* Células quadradas, números maiores, sem distorcer */
            .ticket-row .cell {
              aspect-ratio: 1 / 1 !important;   /* mantém quadrado */
              font-size: 9.2mm !important;      /* números maiores */
              padding: 0 !important;
              border: 0.28mm solid #424242 !important;
              border-radius: 1.2mm !important;
            }
            /* Rodapé fixo com validade na impressão */
            .page-footer {
              position: fixed !important;
              bottom: 0 !important;
              left: 0 !important;
              right: 0 !important;
              height: 8mm !important;               /* altura fixa para cálculo */
              padding: 1.5mm 6mm !important;        /* antes 2mm 6mm */
              font-size: 3.2mm !important;
              color: #111 !important;
              display: flex !important;
              align-items: center !important;
              justify-content: space-between !important;
              border-top: 0.4mm solid #424242 !important;
              background: #fff !important;
            }
          }
        `}
      </style>

      <div className="no-print">
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
          <label style={{ fontWeight: 600 }} htmlFor="validity">Validade: </label>
          <input
            id="validity"
            type="date"
            value={validityDate}
            onChange={(e) => setValidityDate(e.target.value)}
            style={styles.input}
          />
          <button onClick={handleGenerate} style={styles.button}>
            Gerar {qty} {qty === 1 ? "Tira" : "Tiras"}
          </button>
          <button
            onClick={handlePrint}
            style={{ ...styles.button, marginLeft: 8, background: "#2e7d32", borderColor: "#2e7d32" }}
          >
            Imprimir
          </button>
        </div>
      </div>

      {strips.map((tickets, stripIdx) => {
        const v = validations[stripIdx];
        const stripStyle =
          stripIdx === 0 ? styles.stripContainer : styles.stripContainerWithBreak;

        return (
          <div key={stripIdx} style={stripStyle}>
            <div style={styles.stripHeaderRow} className="strip-header">
              <div>
                <strong>Tira #{stripIdx + 1}</strong>
                {v && !v.ok && (
                  <span style={{ color: "#b71c1c", marginLeft: 8 }}>
                    Inválida: faltam [{v.missing.join(", ")}], duplicados [{v.duplicates.join(", ")}]
                  </span>
                )}
              </div>
              {stripValidity[stripIdx] && (
                <div style={{ color: "#555" }}>
                  Validade: {formatDate(stripValidity[stripIdx])}
                </div>
              )}
            </div>

            <div style={styles.stripGrid} className="ticket-grid">
              {tickets.map((ticket, idx) => {
                const hash = stripHashes[stripIdx]?.[idx] ?? "";
                return (
                  <div key={idx} style={styles.ticketCard} className="ticket-card">
                    <div style={styles.ticketHeader} className="ticket-header">
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, width: "100%" }}>
                        <span style={styles.establishment} className="establishment">Vispa Altas Horas</span>
                        <span style={styles.hashBadge}>{hash}</span>
                        <div style={{ whiteSpace: "nowrap" }}>
                          <span style={styles.smallLabel}>
                            Validade: {formatDate(stripValidity[stripIdx] || validityDate)}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div style={styles.ticketBody} className="ticket-body">
                      {ticketToGrid(ticket).map((row, rIdx) => (
                        <div key={rIdx} style={styles.ticketRow} className="ticket-row">
                          {row.map((n, cIdx) => (
                            <div
                              key={`${rIdx}-${cIdx}`}
                              style={{ ...styles.cell, ...(n == null ? styles.cellEmpty : {}) }}
                              className="cell"
                            >
                              {n ?? ""}
                            </div>
                          ))}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>

            <div style={styles.stripFooter} className="strip-footer">
              {!v || v.ok ? "OK" : "Há problemas nesta tira (veja acima)."}
            </div>
          </div>
        );
      })}
    </div>
  );
}

const styles = {
    page: {
        margin: "0 auto",
        padding: 16,
        fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif",
        printColorAdjust: "exact" as any,
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
        gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))",
        gap: 12,
    },
    ticketCard: {
        border: "2px solid #424242",
        borderRadius: 10,
        overflow: "hidden",
        background: "#fff",
        boxShadow: "0 1px 2px rgba(0,0,0,0.06)",
    },
    ticketHeader: {
        background: "#e0e0e0",
        color: "#111",
        padding: "8px 10px",
        fontWeight: 800,
        letterSpacing: "0.3px",
        borderBottom: "2px solid #424242",
    },
    establishment: {
        fontWeight: 800,
        letterSpacing: "0.3px",
    },
    hashBadge: {
        fontFamily:
            "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
        fontWeight: 800,
        color: "#111",
        background: "transparent",
        padding: "0 4px",
        letterSpacing: "0.5px",
        borderRadius: 4,
    },
    ticketBody: {
        padding: 10,
    },
    ticketRow: {
        display: "grid",
        gridTemplateColumns: "repeat(9, 1fr)",
        gap: 6,
        marginBottom: 6,
    },
    cell: {
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        aspectRatio: "1 / 1",
        textAlign: "center",
        padding: 0,
        borderRadius: 6,
        background: "#ffffff",
        border: "2px solid #424242",
        color: "#111",
        fontWeight: 800,
        letterSpacing: "0.5px",
        fontVariantNumeric: "tabular-nums",
        fontSize: 18,
        printColorAdjust: "exact" as any,
        WebkitPrintColorAdjust: "exact" as any,
    },
    cellEmpty: {
        background: "#6b7280",
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
