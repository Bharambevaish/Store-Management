import React, { useState, useMemo } from "react";
import { Printer, Plus, Trash2 } from "lucide-react";

const TEAL = "#087E8B";
const PINK = "#f59cb0";

const defaultItems = [
  "Phenyl",
  "Acid",
  "Handwash Liqued",
  "Glass Liqued",
  "Armos Frescos",
  "Colin",
  "Paper Napkin",
  "H. Pick",
  "Zadu",
  "Mop(W)",
  "Mop(D)",
  "Nateend'Boul",
  "Odonil",
  "Yurinte",
  "Floor Dister",
].map((description, i) => ({
  id: i + 1,
  description,
  qty: "",
  rate: "",
}));

export default function InvoiceGenerator() {
  const [company, setCompany] = useState({
    name: "NARESH ENTERPRISES",
    addressLine1: "Add. Office H. No.34/B, No.31L.H. Colony,",
    addressLine2: "Beside Govt. ITI, NANDED",
    tagline: "ZOOM PHENOL",
  });

  const [invoiceNo, setInvoiceNo] = useState("090");
  const [dateIssued, setDateIssued] = useState("");
  const [issuedTo, setIssuedTo] = useState("");
  const [note, setNote] = useState("");
  const [items, setItems] = useState(defaultItems);

  const total = useMemo(
    () =>
      items.reduce((sum, it) => {
        const q = parseFloat(it.qty) || 0;
        const r = parseFloat(it.rate) || 0;
        return sum + q * r;
      }, 0),
    [items]
  );

  const updateItem = (id, field, value) => {
    setItems((prev) =>
      prev.map((it) => (it.id === id ? { ...it, [field]: value } : it))
    );
  };

  const addItem = () => {
    setItems((prev) => [
      ...prev,
      { id: prev.length ? Math.max(...prev.map((i) => i.id)) + 1 : 1, description: "", qty: "", rate: "" },
    ]);
  };

  const removeItem = (id) => {
    setItems((prev) => prev.filter((it) => it.id !== id));
  };

  const handlePrint = () => window.print();

  const amountFor = (it) => {
    const q = parseFloat(it.qty) || 0;
    const r = parseFloat(it.rate) || 0;
    const amt = q * r;
    return amt ? amt.toFixed(2) : "";
  };

  return (
    <div style={styles.page}>
      <style>{printStyles}</style>

      {/* Control Toolbar */}
      <div className="no-print" style={styles.toolbar}>
        <button style={styles.printBtn} onClick={handlePrint}>
          <Printer size={16} style={{ marginRight: 6 }} />
          Print Invoice
        </button>
        <span style={styles.toolbarHint}>
          Fill in fields below — invoice layout matches the reference exactly when printed or saved to PDF.
        </span>
      </div>

      {/* Main Invoice Sheet */}
      <div className="invoice-sheet" style={styles.sheet}>
        {/* Decorative Top-Right Corner Overlay */}
        <svg
          width="340"
          height="340"
          viewBox="0 0 340 340"
          style={styles.svgTopRight}
        >
          {/* Dark Teal Polygon */}
          <polygon points="120,0 340,0 340,285 95,145" fill={TEAL} />
          {/* Soft Pink Triangle Overlay */}
          <polygon points="135,0 340,0 340,135" fill={PINK} />
        </svg>

        {/* Decorative Bottom-Left Corner Overlay */}
        <svg
          width="340"
          height="340"
          viewBox="0 0 340 340"
          style={styles.svgBottomLeft}
        >
          {/* Soft Pink Polygon */}
          <polygon points="0,150 0,340 280,340" fill={PINK} />
          {/* Dark Teal Polygon */}
          <polygon points="0,185 150,175 95,340 0,340" fill={TEAL} />
        </svg>

        <div style={styles.content}>
          {/* Header Section */}
          <div style={styles.headerBlock}>
            <input
              className="field-input header-name"
              style={styles.companyName}
              value={company.name}
              onChange={(e) => setCompany({ ...company, name: e.target.value })}
            />
            <input
              className="field-input header-address"
              style={styles.addressLine}
              value={company.addressLine1}
              onChange={(e) =>
                setCompany({ ...company, addressLine1: e.target.value })
              }
            />
            <input
              className="field-input header-address"
              style={styles.addressLine}
              value={company.addressLine2}
              onChange={(e) =>
                setCompany({ ...company, addressLine2: e.target.value })
              }
            />
            <div style={styles.rule} />
            <input
              className="field-input header-tagline"
              style={styles.tagline}
              value={company.tagline}
              onChange={(e) => setCompany({ ...company, tagline: e.target.value })}
            />

            <h1 style={styles.invoiceTitle}>INVOICE</h1>
          </div>

          {/* Meta Info Row */}
          <div style={styles.metaRow}>
            <div style={styles.metaColLeft}>
              <div style={styles.metaBlock}>
                <span style={styles.metaLabel}>Invoice No.:</span>
                <input
                  className="field-input meta-input"
                  style={styles.invoiceNoInput}
                  value={invoiceNo}
                  onChange={(e) => setInvoiceNo(e.target.value)}
                />
              </div>

              <div style={{ ...styles.metaBlock, marginTop: 14 }}>
                <span style={styles.metaLabel}>Date Issued:</span>
                <input
                  className="field-input meta-input"
                  style={styles.dateInput}
                  value={dateIssued}
                  onChange={(e) => setDateIssued(e.target.value)}
                  placeholder="  /   /"
                />
              </div>
            </div>

            <div style={styles.metaColRight}>
              <div style={styles.issuedToBlock}>
                <span style={styles.metaLabel}>Issued to:</span>
                <div style={styles.issuedToRow}>
                  <span style={styles.shriPrefix}>Shri</span>
                  <input
                    className="field-input underline-input"
                    style={styles.issuedToInput}
                    value={issuedTo}
                    onChange={(e) => setIssuedTo(e.target.value)}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Table */}
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={{ ...styles.th, width: "7.5%" }}>NO</th>
                <th style={{ ...styles.th, width: "43.5%", textAlign: "center" }}>DESCRIPTION</th>
                <th style={{ ...styles.th, width: "12%" }}>QTY</th>
                <th style={{ ...styles.th, width: "18%" }}>
                  RATE<br />(Rs.)
                </th>
                <th style={{ ...styles.th, width: "19%" }}>
                  AMOUNT<br />(Rs.)
                </th>
                <th className="no-print" style={styles.thAction} />
              </tr>
            </thead>
            <tbody>
              {items.map((it, idx) => (
                <tr key={it.id}>
                  <td style={styles.tdNo}>{idx + 1}.</td>
                  <td style={styles.tdDesc}>
                    <input
                      className="field-input cell-input"
                      style={styles.cellInput}
                      value={it.description}
                      onChange={(e) =>
                        updateItem(it.id, "description", e.target.value)
                      }
                    />
                  </td>
                  <td style={styles.tdQty}>
                    <input
                      className="field-input cell-input"
                      style={{ ...styles.cellInput, textAlign: "center" }}
                      value={it.qty}
                      onChange={(e) => updateItem(it.id, "qty", e.target.value)}
                      inputMode="decimal"
                    />
                  </td>
                  <td style={styles.tdRate}>
                    <input
                      className="field-input cell-input"
                      style={{ ...styles.cellInput, textAlign: "center" }}
                      value={it.rate}
                      onChange={(e) => updateItem(it.id, "rate", e.target.value)}
                      inputMode="decimal"
                    />
                  </td>
                  <td style={styles.tdAmount}>{amountFor(it)}</td>
                  <td className="no-print" style={styles.tdAction}>
                    <button
                      style={styles.iconBtn}
                      onClick={() => removeItem(it.id)}
                      title="Remove row"
                    >
                      <Trash2 size={13} />
                    </button>
                  </td>
                </tr>
              ))}
              <tr>
                <td colSpan={4} style={styles.totalLabel}>
                  TOTAL
                </td>
                <td style={styles.totalValue}>
                  {total ? total.toFixed(2) : ""}
                </td>
                <td className="no-print" style={{ border: "none" }} />
              </tr>
            </tbody>
          </table>

          <button className="no-print" style={styles.addRowBtn} onClick={addItem}>
            <Plus size={14} style={{ marginRight: 4 }} />
            Add Row
          </button>

          {/* Footer Section */}
          <div style={styles.footerRow}>
            <div style={styles.footerLeft}>
              <div style={styles.noteBlock}>
                <span style={styles.metaLabel}>Note:</span>
                <input
                  className="field-input"
                  style={styles.noteInput}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                />
              </div>

              <div style={styles.forCompanyRow}>
                <span style={styles.forPrefix}>For : </span>
                <span style={styles.companyNameFooter}>{company.name}</span>
              </div>
            </div>

            <div style={styles.footerRight}>
              <span style={styles.thankYouText}>Thank You...</span>
              <div style={styles.signatureLine} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const printStyles = `
  @import url('https://fonts.googleapis.com/css2?family=Caveat:wght@600;700&family=Montserrat:wght@400;500;600;700;800;900&display=swap');

  @media print {
    @page {
      size: A4 portrait;
      margin: 0;
    }
    body {
      margin: 0 !important;
      padding: 0 !important;
      background: white !important;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    .no-print {
      display: none !important;
    }
    .invoice-sheet {
      box-shadow: none !important;
      border: none !important;
      border-radius: 0 !important;
      width: 100% !important;
      max-width: 100% !important;
      margin: 0 !important;
      min-height: 100vh !important;
    }
    .field-input {
      border: none !important;
      outline: none !important;
    }
  }

  .field-input {
    font-family: inherit;
    color: inherit;
    background: transparent;
    border: none;
    outline: none;
    padding: 0;
  }
  .field-input:focus {
    background: rgba(0, 128, 153, 0.04);
    border-radius: 2px;
  }
  .underline-input {
    border-bottom: 1px solid #1f2427 !important;
  }
`;

const styles = {
  page: {
    minHeight: "100vh",
    background: "#eef2f5",
    padding: "24px 12px 60px",
    fontFamily:
      "'Montserrat', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
  },
  toolbar: {
    width: "100%",
    maxWidth: 820,
    display: "flex",
    alignItems: "center",
    gap: 16,
    marginBottom: 18,
    flexWrap: "wrap",
  },
  printBtn: {
    display: "flex",
    alignItems: "center",
    background: TEAL,
    color: "white",
    border: "none",
    borderRadius: 6,
    padding: "9px 18px",
    fontSize: 14,
    fontWeight: 600,
    cursor: "pointer",
    boxShadow: "0 2px 8px rgba(0,128,153,0.3)",
  },
  toolbarHint: {
    fontSize: 13,
    color: "#5a656d",
  },
  sheet: {
    position: "relative",
    width: "100%",
    maxWidth: 820,
    minHeight: 1100,
    background: "#ffffff",
    boxShadow: "0 10px 30px rgba(0,0,0,0.12)",
    borderRadius: 2,
    overflow: "hidden",
  },
  svgTopRight: {
    position: "absolute",
    top: 0,
    right: 0,
    pointerEvents: "none",
    zIndex: 0,
  },
  svgBottomLeft: {
    position: "absolute",
    bottom: 0,
    left: 0,
    pointerEvents: "none",
    zIndex: 0,
  },
  content: {
    position: "relative",
    zIndex: 1,
    padding: "48px 56px 44px 56px",
  },
  headerBlock: {
    marginBottom: 24,
  },
  companyName: {
    fontSize: 26,
    fontWeight: 900,
    color: TEAL,
    letterSpacing: 0.5,
    marginBottom: 4,
    width: "100%",
    display: "block",
  },
  addressLine: {
    fontSize: 13.5,
    fontWeight: 700,
    color: "#1f2427",
    lineHeight: 1.35,
    width: "100%",
    display: "block",
  },
  rule: {
    height: 2.5,
    width: 250,
    background: TEAL,
    marginTop: 6,
    marginBottom: 8,
  },
  tagline: {
    fontSize: 17,
    fontWeight: 900,
    color: TEAL,
    marginBottom: 24,
    width: "100%",
    display: "block",
    letterSpacing: 0.3,
  },
  invoiceTitle: {
    fontSize: 48,
    fontWeight: 900,
    letterSpacing: 6,
    color: "#1f2427",
    margin: "0 0 24px 0",
    textTransform: "uppercase",
  },
  metaRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 26,
    gap: 32,
  },
  metaColLeft: {
    flex: 1,
    maxWidth: 320,
  },
  metaColRight: {
    flex: 1.3,
  },
  metaBlock: {
    display: "flex",
    flexDirection: "column",
    gap: 4,
  },
  metaLabel: {
    fontSize: 13.5,
    fontWeight: 800,
    color: "#1f2427",
  },
  invoiceNoInput: {
    fontSize: 14,
    fontWeight: 600,
    color: "#1f2427",
  },
  dateInput: {
    fontSize: 14,
    fontWeight: 600,
    color: "#1f2427",
  },
  issuedToBlock: {
    display: "flex",
    flexDirection: "column",
    gap: 6,
  },
  issuedToRow: {
    display: "flex",
    alignItems: "baseline",
    gap: 10,
    width: "100%",
  },
  shriPrefix: {
    fontSize: 14,
    fontWeight: 600,
    color: "#1f2427",
    flexShrink: 0,
  },
  issuedToInput: {
    fontSize: 14,
    fontWeight: 600,
    color: "#1f2427",
    flex: 1,
    width: "100%",
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
    border: "1.5px solid #8c9498",
    marginBottom: 14,
  },
  th: {
    background: "#dedede",
    border: "1.5px solid #8c9498",
    padding: "10px 6px",
    fontSize: 13,
    fontWeight: 900,
    color: "#1f2427",
    textAlign: "center",
    verticalAlign: "middle",
    letterSpacing: 0.3,
  },
  thAction: {
    border: "none",
    background: "transparent",
    width: 32,
  },
  tdNo: {
    border: "1.5px solid #8c9498",
    padding: "7px 10px",
    fontSize: 13.5,
    fontWeight: 700,
    color: "#1f2427",
    textAlign: "center",
    verticalAlign: "middle",
  },
  tdDesc: {
    border: "1.5px solid #8c9498",
    padding: "6px 12px",
    fontSize: 13.5,
    fontWeight: 600,
    color: "#1f2427",
    verticalAlign: "middle",
  },
  tdQty: {
    border: "1.5px solid #8c9498",
    padding: "6px 8px",
    fontSize: 13.5,
    fontWeight: 600,
    color: "#1f2427",
    verticalAlign: "middle",
  },
  tdRate: {
    border: "1.5px solid #8c9498",
    padding: "6px 8px",
    fontSize: 13.5,
    fontWeight: 600,
    color: "#1f2427",
    verticalAlign: "middle",
  },
  tdAmount: {
    border: "1.5px solid #8c9498",
    padding: "7px 10px",
    fontSize: 13.5,
    fontWeight: 700,
    color: "#1f2427",
    textAlign: "right",
    verticalAlign: "middle",
  },
  tdAction: {
    border: "none",
    textAlign: "center",
    verticalAlign: "middle",
  },
  cellInput: {
    fontSize: 13.5,
    fontWeight: 600,
    color: "#1f2427",
    width: "100%",
  },
  iconBtn: {
    background: "none",
    border: "none",
    color: "#d93838",
    cursor: "pointer",
    padding: 4,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    opacity: 0.7,
  },
  totalLabel: {
    border: "1.5px solid #8c9498",
    background: "#dedede",
    padding: "10px",
    fontSize: 15,
    fontWeight: 900,
    color: "#1f2427",
    textAlign: "center",
    letterSpacing: 1.5,
  },
  totalValue: {
    border: "1.5px solid #8c9498",
    background: "#ffffff",
    padding: "10px 12px",
    fontSize: 14,
    fontWeight: 800,
    color: "#1f2427",
    textAlign: "right",
  },
  addRowBtn: {
    display: "flex",
    alignItems: "center",
    background: "transparent",
    border: `1.5px dashed ${TEAL}`,
    color: TEAL,
    borderRadius: 6,
    padding: "6px 14px",
    fontSize: 13,
    fontWeight: 700,
    cursor: "pointer",
    marginBottom: 40,
  },
  footerRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-end",
    gap: 32,
    marginTop: 20,
  },
  footerLeft: {
    flex: 1,
  },
  noteBlock: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    marginBottom: 14,
  },
  noteInput: {
    fontSize: 13.5,
    fontWeight: 600,
    color: "#1f2427",
    borderBottom: "1px dashed #a0aab0",
    maxWidth: 320,
    flex: 1,
  },
  forCompanyRow: {
    fontSize: 14,
    fontWeight: 800,
  },
  forPrefix: {
    color: "#1f2427",
    fontWeight: 800,
  },
  companyNameFooter: {
    color: "#1f2427",
    fontWeight: 900,
    letterSpacing: 0.3,
  },
  footerRight: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    minWidth: 200,
  },
  thankYouText: {
    fontFamily: "'Caveat', cursive",
    fontSize: 32,
    fontWeight: 700,
    color: "#1f2427",
    lineHeight: 1,
    marginBottom: 4,
  },
  signatureLine: {
    borderTop: "1.5px solid #5a656d",
    width: "100%",
  },
};

