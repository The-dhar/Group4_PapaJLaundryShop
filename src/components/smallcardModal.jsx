import React, { useState, useEffect } from 'react';
import '../componentstyle/smallcardModal.css';

const SmallcardModal = ({ isOpen, onClose, item, onAdd }) => {
  const [laundryType, setLaundryType] = useState('wash-and-fold');
  const [kilos, setKilos] = useState(1);
  const [notes, setNotes] = useState('');
  useEffect(() => {
    if (isOpen && item) {
      setKilos(1);
      setLaundryType('wash-and-fold');
      setNotes('');
    }
  }, [isOpen, item,setLaundryType]);

  if (!isOpen || !item) return null;

  const handleKilosChange = (e) => {
    const value = Math.max(0.1, parseFloat(e.target.value) || 0.1);
    setKilos(value);
  };

  const handleIncrementKilos = () => {
    setKilos(prev => prev + 0.5);
  };

  const handleDecrementKilos = () => {
    setKilos(prev => Math.max(0.5, prev - 0.5));
  };

  const handleAdd = () => {
    if (kilos <= 0) {
      alert('Please enter a valid number of kilos.');
      return;
    }
    
    const laundryItem = {
      ...item,
      kilos,
      laundryType,
      notes,
      total: item.price * kilos
    };

    if (onAdd) {
      onAdd(laundryItem);
    }
    

    setKilos(1);
    setLaundryType('wash-and-fold');
    setNotes('');
    onClose();
  };

  const handleCancel = () => {
    setKilos(1);
    setLaundryType('wash-and-fold');
    setNotes('');
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
                <button 
                  type="button" 
                  className="spinner-btn spinner-up"
                  onClick={handleIncrementKilos}
                  aria-label="Increase kilos"
                >
                  ▲
                </button>
                <button 
                  type="button" 
                  className="spinner-btn spinner-down"
                  onClick={handleDecrementKilos}
                  aria-label="Decrease kilos"
                >
                  ▼
                </button>
              </div>
            </div>
          </div>

          
          <div className="modal-input-group">
            <label className="modal-label">Laundry Type:</label>
            <select
              className="modal-select"
              value={laundryType}
              onChange={(e) => setLaundryType(e.target.value)}
            >
              <option value="wash-and-fold">Wash and Fold</option>
              <option value="wash-and-dry">Dry only</option>
            </select>
          </div>

          <div className="modal-input-group">
            <label className="modal-label">Notes (Optional):</label>
            <textarea
              className="modal-textarea"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="eg delicates only"
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