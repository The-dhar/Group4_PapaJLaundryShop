import React, { useEffect, useState } from "react";
import "../componentstyle/smallcardModal.css";
import '../componentstyle/customerModalstylesheet.css';

const CustomerModal = ({ isOpen, onClose, onSave, initial }) => {
  // Chopped States
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [street, setStreet] = useState("");
  const [barangay, setBarangay] = useState("");
  const [city, setCity] = useState("");

  useEffect(() => {
    if (isOpen) {
      // If initial data exists, we pre-fill (useful for editing)
      setFirstName(initial?.firstName || "");
      setLastName(initial?.lastName || "");
      setStreet(initial?.street || "");
      setBarangay(initial?.barangay || "");
      setCity(initial?.city || "");
    }
  }, [isOpen, initial]);

  if (!isOpen) return null;

  const handleSave = () => {
    // Validation: Check if required fields are filled
    if (!firstName || !lastName || !street || !barangay || !city) {
      alert("Please fill in all customer information fields.");
      return;
    }

    // Send the chopped data back to POs.jsx
    onSave({ 
      firstName, 
      lastName, 
      street, 
      barangay, 
      city 
    });
    
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Add New Customer</h2>
        </div>
        
        <div className="modal-body">
          {/* Name Section */}
          <div style={{ display: 'flex', gap: '10px' }}>
            <div className="modal-input-group" style={{ flex: 1 }}>
              <label className="modal-label">First Name</label>
              <input
                type="text"
                className="modal-kilos-input"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="John"
              />
            </div>
            <div className="modal-input-group" style={{ flex: 1 }}>
              <label className="modal-label">Last Name</label>
              <input
                type="text"
                className="modal-kilos-input"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="Doe"
              />
            </div>
          </div>

          {/* Address Section */}
          <div className="modal-input-group">
            <label className="modal-label">Street / Drive</label>
            <input
              type="text"
              className="modal-kilos-input"
              value={street}
              onChange={(e) => setStreet(e.target.value)}
              placeholder="123 Apple St."
            />
          </div>

          <div style={{ display: 'flex', gap: '10px' }}>
            <div className="modal-input-group" style={{ flex: 1 }}>
              <label className="modal-label">Barangay</label>
              <input
                type="text"
                className="modal-kilos-input"
                value={barangay}
                onChange={(e) => setBarangay(e.target.value)}
                placeholder="Brgy. 1"
              />
            </div>
            <div className="modal-input-group" style={{ flex: 1 }}>
              <label className="modal-label">City</label>
              <input
                type="text"
                className="modal-kilos-input"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="City Name"
              />
            </div>
          </div>
        </div>

        <div className="modal-footer">
          <button className="modal-btn cancel-btn" onClick={onClose}>
            Cancel
          </button>
          <button className="modal-btn add-btn" onClick={handleSave}>
            Save Customer
          </button>
        </div>
      </div>
    </div>
  );
};

export default CustomerModal;


