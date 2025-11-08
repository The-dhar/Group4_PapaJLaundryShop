import React, { useEffect, useState } from "react";

import "../componentstyle/smallcardModal.css";

const CustomerModal = ({ isOpen, onClose, onSave, initial }) => {
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");

  useEffect(() => {
    if (isOpen) {
      setName(initial?.name || "");
      setAddress(initial?.address || "");
      setPhone(initial?.phone || "");
    }
  }, [isOpen, initial]);

  if (!isOpen) return null;

  const handleSave = () => {
    if (!name || !address || !phone) {
      alert("Please fill all customer fields.");
      return;
    }
    onSave({ name, address, phone });
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Add customer</h2>
        </div>
        <div className="modal-body">
          <div className="modal-input-group">
            <label className="modal-label">Name</label>
            <input
              type="text"
              className="modal-kilos-input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Full name"
            />
          </div>
          <div className="modal-input-group">
            <label className="modal-label">Address</label>
            <input
              type="text"
              className="modal-kilos-input"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Street, City"
            />
          </div>
          <div className="modal-input-group">
            <label className="modal-label">Phone</label>
            <input
              type="text"
              className="modal-kilos-input"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="09xx xxx xxxx"
            />
          </div>
        </div>
        <div className="modal-footer">
          <button className="modal-btn modal-btn-cancel" onClick={onClose}>
            Cancel
          </button>
          <button className="modal-btn modal-btn-add" onClick={handleSave}>
            Save
          </button>
        </div>
      </div>
    </div>
  );
};

export default CustomerModal;


