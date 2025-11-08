import React from 'react';
import '../componentstyle/smallCard.css';

const LaundryCard = ({ icon, name, price, onCardClick }) => {
    const displayPrice = typeof price === 'number' ? price.toFixed(2) : '0.00';
 return (
    <div onClick={onCardClick} className="laundry-card">
  
       <img src={icon} alt={name} className="small-card-icon" />
      <div className="laundry-name">{name}</div>
      <div className="laundry-price">₱{displayPrice}</div>
      <div className="laundry-unit">per kilo</div>
    </div>
  );
};

export default LaundryCard;