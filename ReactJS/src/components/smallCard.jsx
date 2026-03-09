import React from 'react';
import '../componentstyle/smallCard.css';

const LaundryCard = ({ icon, name, pricing = [], onCardClick }) => {
  return (
    <div onClick={onCardClick} className="laundry-card">
      <img src={icon} alt={name} className="small-card-icon" />
      <div className="laundry-name">{name}</div>
    </div>
  );
};

export default LaundryCard;