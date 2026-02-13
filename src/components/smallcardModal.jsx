import React, { useState, useEffect } from 'react';
import '../componentstyle/smallcardModal.css';

const SmallcardModal = ({ isOpen, onClose, item, onAdd }) => {
  const [kilos, setKilos] = useState(1);
  const [laundryType, setLaundryType] = useState("wash-and-fold");
  const [notes, setNotes] = useState("");
  const [selectedTier, setSelectedTier] = useState(null);

  useEffect(() => {
    if (isOpen && item) {
      setKilos(1);
      setNotes("");

      // AUTO-SET LAUNDRY TYPE BASED ON CARD NAME
      if (item.name.toLowerCase().includes("dry")) {
        setLaundryType("dry-only");
      } else {
        setLaundryType("wash-and-fold");
      }

      // INITIAL PRICE
      const initialInfo = calculatePriceInfo(1);
      setSelectedTier(initialInfo);
    }
  }, [isOpen, item]);

  if (!isOpen || !item) return null;

  /** =======================
   * MAIN PRICING LOGIC
   * ======================= */
  const calculatePriceInfo = (kilosValue) => {
    if (!item) return null;

    const kv = Number(kilosValue);
    const name = item.name.toLowerCase();

    if (isNaN(kv)) return null;

    /** ------------------------------
     * FIXED: DRYING SERVICE CARD
     * ------------------------------ */
    if (name === "drying") {
      if (kv <= 6)
        return { computedTotal: 120, label: "₱120 (1–6 kg)" };

      if (kv > 6 && kv <= 8)
        return { computedTotal: 150, label: "₱150 (6.1–8 kg)" };

      if (kv > 8) {
        const cycles = Math.ceil(kv / 8);
        const total = cycles * 150;
        return {
          computedTotal: total,
          label: `₱${total.toFixed(2)} (${cycles} cycles)`
        };
      }
    }

    /** ----------------------------------------
     * BEDSHEET / BLANKET / CURTAIN / TOWEL ETC.
     * ---------------------------------------- */
    if (
      name.includes("bedsheet") ||
      name.includes("blanket") ||
      name.includes("curtain") ||
      name.includes("towel") ||
      name.includes("customer")
    ) {
      if (laundryType === "wash-and-fold") {
        if (kv <= 3) return { computedTotal: 150, label: "₱150 (1–3 kg)" };

        if (kv > 3 && kv <= 5) {
          const extra = (kv - 3) * 50;
          const total = 150 + extra;
          return {
            computedTotal: total,
            label: `₱${total.toFixed(2)} (₱50 per succeeding kg)`
          };
        }

        if (kv > 5) {
          const cycles = Math.ceil(kv / 5);
          const total = cycles * 150;
          return {
            computedTotal: total,
            label: `₱${total.toFixed(2)} (${cycles} cycles)`
          };
        }
      }

      if (laundryType === "dry-only") {
        if (kv <= 6)
          return { computedTotal: 120, label: "₱120 (1–6 kg)" };

        if (kv > 6 && kv <= 8)
          return { computedTotal: 150, label: "₱150 (6.1–8 kg)" };

        if (kv > 8) {
          const cycles = Math.ceil(kv / 8);
          const total = cycles * 150;
          return {
            computedTotal: total,
            label: `₱${total.toFixed(2)} (${cycles} cycles)`
          };
        }
      }
    }

    /** ----------------------------------------
     * REGULAR CLOTHES
     * ---------------------------------------- */
    if (name.includes("regular")) {
      if (kv <= 6) return { computedTotal: 150, label: "₱150 (1 cycle)" };
      if (kv > 6 && kv <= 7) return { computedTotal: 175, label: "₱175" };
      if (kv > 7 && kv <= 8) {
        const extra = (kv - 7) * 25;
        return { computedTotal: 175 + extra, label: "₱175 + ₱25 succeeding" };
      }
      const cycles = Math.ceil(kv / 8);
      return { computedTotal: cycles * 150, label: `${cycles} cycles` };
    }

    /** ----------------------------------------
     * WHITE CLOTHES
     * ---------------------------------------- */
    if (name.includes("white")) {
      if (kv <= 6) return { computedTotal: 150, label: "₱150 (1 cycle)" };
      if (kv > 6 && kv <= 7) return { computedTotal: 185, label: "₱185" };
      if (kv > 7 && kv <= 8) {
        const extra = (kv - 7) * 35;
        return { computedTotal: 185 + extra, label: "₱185 + ₱35 succeeding" };
      }
      const cycles = Math.ceil(kv / 8);
      return { computedTotal: cycles * 150, label: `${cycles} cycles` };
    }

    return null;
  };

  const handleKilosChange = (e) => {
    const value = Math.max(0.5, parseFloat(e.target.value));
    setKilos(value);
    setSelectedTier(calculatePriceInfo(value));
  };

  const changeKilos = (step) => {
    const newVal = Math.max(0.5, Number((kilos + step).toFixed(2)));
    setKilos(newVal);
    setSelectedTier(calculatePriceInfo(newVal));
  };

  const handleAdd = () => {
    if (!selectedTier) {
      alert("Invalid pricing");
      return;
    }

    onAdd(
      item,
      null,
      kilos,
      laundryType,
      { computedTotal: selectedTier.computedTotal, unit: "computed" }
    );

    handleCancel();
  };

  const handleCancel = () => {
    setKilos(1);
    setLaundryType("wash-and-fold");
    setNotes("");
    setSelectedTier(null);
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={handleCancel}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{item.name}</h2>
        </div>

        <div className="modal-body">
          <div className="modal-input-group">
            <label className="modal-label">Kilos:</label>
            <div className="kilos-input-wrapper">
              <input
                type="number"
                className="modal-kilos-input"
                value={kilos}
                onChange={handleKilosChange}
                min="0.5"
                step="0.5"
              />
              <div className="kilos-spinner">
                <button type="button" className="spinner-btn" data-arrow="▲" aria-label="Increase kilos" onClick={() => changeKilos(0.5)}></button>
                <button type="button" className="spinner-btn" data-arrow="▼" aria-label="Decrease kilos" onClick={() => changeKilos(-0.5)}></button>
              </div>
            </div>
          </div>

          <div className="modal-input-group">
            <label className="modal-label">Laundry Type:</label>
            <div className="modal-select readonly-box">
              {laundryType === "wash-and-fold" ? "Wash and Fold" : "Dry Only"}
            </div>
          </div>

          <div className="modal-input-group">
            <label className="modal-label">Fixed Price:</label>
            <div className="modal-select price-box">
              {selectedTier ? selectedTier.label : "₱0"}
            </div>
          </div>

          <div className="modal-input-group">
            <label className="modal-label">Total Amount:</label>
            <div className="modal-select total-box">
              ₱{selectedTier ? selectedTier.computedTotal.toFixed(2) : "0.00"}
            </div>
          </div>

          <div className="modal-input-group">
            <label className="modal-label">Notes (Optional):</label>
            <textarea
              className="modal-textarea"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows="3"
            />
          </div>
        </div>

        <div className="modal-footer">
          <button onClick={handleCancel} className="modal-btn modal-btn-cancel">
            Cancel
          </button>
          <button onClick={handleAdd} className="modal-btn modal-btn-add">
            Add
          </button>
        </div>
      </div>
    </div>
  );
};

export default SmallcardModal;
