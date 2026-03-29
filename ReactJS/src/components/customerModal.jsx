import React, { useEffect, useState } from "react";

import "../componentstyle/smallcardModal.css";
import '../componentstyle/customerModalstylesheet.css';

const CustomerModal = ({ isOpen, onClose, onSave, initial }) => {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [street, setStreet] = useState("");
  const [barangay, setBarangay] = useState("");
  const [city, setCity] = useState("");

  useEffect(() => {
    if (isOpen) {
      const existingName = initial?.name || "";
      const existingAddress = initial?.address || "";

      const [parsedFirstName = "", ...nameRest] = existingName.trim().split(" ");
      const parsedLastName = nameRest.join(" ");

      const addressParts = existingAddress.split(",").map((part) => part.trim());

      setFirstName(parsedFirstName);
      setLastName(parsedLastName);
      setStreet(addressParts[0] || "");
      setBarangay(addressParts[1] || "");
      setCity(addressParts[2] || "");
    }
  }, [isOpen, initial]);

  if (!isOpen) return null;

  const handleSave = () => {
    if (!firstName.trim() || !lastName.trim() || !street.trim() || !barangay.trim() || !city.trim()) {
      alert("Please fill all customer fields.");
      return;
    }

    const name = `${firstName.trim()} ${lastName.trim()}`.trim();
    const address = `${street.trim()}, ${barangay.trim()}, ${city.trim()}`;

    onSave({
      name,
      address,
      first_name: firstName.trim(),
      last_name: lastName.trim(),
      street: street.trim(),
      barangay: barangay.trim(),
      city: city.trim()
    });

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
            <label className="modal-label">First Name</label>
            <input
              type="text"
              className="modal-kilos-input"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              placeholder="First name"
            />
          </div>
          <div className="modal-input-group">
            <label className="modal-label">Last Name</label>
            <input
              type="text"
              className="modal-kilos-input"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              placeholder="Last name"
            />
          </div>
          <div className="modal-input-group">
            <label className="modal-label">Street / Drive</label>
            <input
              type="text"
              className="modal-kilos-input"
              value={street}
              onChange={(e) => setStreet(e.target.value)}
              placeholder="Street / Drive"
            />
          </div>
          <div className="modal-input-group">
            <label className="modal-label">Barangay</label>
            <input
              type="text"
              className="modal-kilos-input"
              value={barangay}
              onChange={(e) => setBarangay(e.target.value)}
              placeholder="Barangay"
            />
          </div>
          <div className="modal-input-group">
            <label className="modal-label">City</label>
            <input
              type="text"
              className="modal-kilos-input"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              placeholder="City"
            />
          </div>
        </div>
        <div className="modal-footer">
          <button className="modal-btn cancel-btn" onClick={onClose}>
            Cancel
          </button>
          <button className="modal-btn add-btn" onClick={handleSave}>
            Save
          </button>
        </div>
      </div>
    </div>
  );
};

export default CustomerModal;


