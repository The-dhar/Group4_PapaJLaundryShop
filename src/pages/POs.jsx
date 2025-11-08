import React from 'react';
import { useState } from 'react';
import { BsSearch } from 'react-icons/bs';
import DashboardLayout from '../components/dashboardlayout';
import SmallCard from '../components/smallCard';
import SmallcardModal from '../components/smallcardModal';
import CustomerModal from '../components/customerModal';
import '../styles/posstyle.css';
const POs = () => {
  const [selectedItem, setSelectedItem ] = useState(null);
  const [selectedServices, setSelectedServices] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [paymentStatus, setPaymentStatus] = useState('');
  const [laundryType, setLaundryType] = useState('wash-and-fold');
  const [paymentMethod, setPaymentMethod] = useState('');
  const [extraChargeType, setExtraChargeType] = useState('none');
const [discountAmount, setDiscountAmount] = useState(0);
  const laundryItems = [
    { id: 1, icon: '/pictures/clean-clothes.png', name: 'Clothes', price: 25.0 },
    { id: 2, icon: '/pictures/pants.png', name: 'Pants', price: 35.0 },
    { id: 3, icon: '/pictures/blanket.png', name: 'Blankets', price: 40.0 },
    { id: 4, icon: '/pictures/curtain.png', name: 'Curtains', price: 50.0 },
    { id: 5, icon: '/pictures/towel.png', name: 'Comforters', price: 45.0 },
    { id: 6, icon: '/pictures/male-clothes.png', name: 'Mix Clothes', price: 30.0 },
  ];
  const handleAddServiceFromModal = (laundryItem) => {
  setSelectedServices((prev) => [
    ...prev,
    {
      id: laundryItem.id, 
      serviceName: laundryItem.name,
      rate: laundryItem.price,
      kilos: laundryItem.kilos,
      laundryType: laundryItem.laundryType,
      total: laundryItem.total,
    },
  ]);
};
  const handleCardClick = (item) => {
    setSelectedItem(item);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedItem(null);
  };
  const [customerName, setCustomerName] = useState("");
  const [customerAddress, setCustomerAddress] = useState("");
  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);


  const calculateSubtotal = () => {
  return selectedServices.reduce((sum, service) => sum + (service.total || 0), 0);
};


const calculateExtras = () => {
  return 0; 
};
const calculateTotal = () => {
  const subtotal = calculateSubtotal() + calculateExtras();
  let extraCharge = 0;

  if (extraChargeType === 'discount') {
    extraCharge = -Number(discountAmount || 0);
  } else if (extraChargeType === 'express') {
    extraCharge = 100;
  }

  const total = subtotal + extraCharge;
  return isNaN(total) ? 0 : total;
};
const handleCompleteTransaction = () => {


  if (!customerName || !customerAddress|| selectedServices.length === 0) {
    alert("Please complete all customer and service details before saving.");
    return;
  }
  alert("Transaction saved successfully!" );
};

    return (
       <DashboardLayout>
          <div className="pos-wrapper">
        <div className='pos-container'>

            <div className='Service-item'>
                <div className='Service-item-title'>Service Items
            <div className="content-wrapper">
        <div className="laundry-grid">
          {laundryItems.map((item) => (
            <SmallCard
              key={item.id}
              icon={item.icon}
              name={item.name}
              price={item.price}
              onCardClick={() => handleCardClick(item)}
                isOpen={isModalOpen}
              onClose={handleCloseModal}
              item={selectedItem}
              onAdd={handleAddServiceFromModal}
              laundryType={laundryType}     
              setLaundryType={setLaundryType}
            />
          ))}
        </div>
            </div>
           <SmallcardModal
             isOpen={isModalOpen}
           onClose={handleCloseModal}
           item={selectedItem}
           onAdd={handleAddServiceFromModal}
            />
           </div>
              </div>
                 </div>

                <div className="receipt-section">
                  <div className="for-receipt-information">
               <div className="for-receipt">
             <div className="for-receipt-top">
               <div className="for-receipt-searchbar">
           <BsSearch className="for-receipt-searchicon" />
           <input
             type="text"
             placeholder="Search Customer..."
             className="for-receipt-searchinput"
            />
           </div>

           <button
           className="for-receipt-add-customer"
            onClick={() => setIsCustomerModalOpen(true)}>
            Add Customer
         </button>
          </div>

           <CustomerModal
            isOpen={isCustomerModalOpen}
                onClose={() => setIsCustomerModalOpen(false)}
                   initial={{
                   name: customerName,
               address: customerAddress,
               
                   }}
              onSave={({ name, address, phone }) => {
                   setCustomerName(name);
                     setCustomerAddress(address);
                  
                       }}
                  />
                   <div className="for-receipt-bottom">
                       <div className="for-receipt-generator">ORD-01933</div>
                    <div className="for-receipt-calendar">
                       <input type="date" className="for-receipt-date" />
                      </div>
                      </div>
                    </div>


                      </div> 
                       <div className='for-receipt-output-customername'>
                       Name:
                       <input type="text"  placeholder="Name"  className='for-receipt-customerinput'value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}/>
                      Address: 
                      <input type="text"  placeholder="Address"  className='for-receipt-customerinput'value={customerAddress}
                       onChange={(e) => setCustomerAddress(e.target.value)}/>
                  
                     </div>            
                      <div className='for-receipt-totalitems'>
                         <div className="mini-item-row mini-item-header">
                          <span className="mini-item-name">Service</span>
                        <span className="mini-item-laundryType">Laundry Type</span>
                        <span className="mini-item-rate">Rate per Kilo</span>
                        <span className="mini-item-kilos">Kilos</span>
                      </div>
                       {selectedServices.map((service) => (
                      <div key={`mini-${service.id}`} className="mini-item-row">
                     <span className="mini-item-name">{service.serviceName}</span>
                      <span className="mini-item-laundryType">{service.laundryType}</span>
                     <span className="mini-item-rate">₱ {service.rate.toFixed(2)}</span>
                    <span className="mini-item-kilos">{service.kilos} kg</span>
                    <span className="mini-item-total">₱ {(service.total).toFixed(2)}</span>
                    </div>
                    ))}
                    <div className='container-information'>
           <div className='for-receipt-status'>
  <h3>Select Payment Information</h3>
  <div className="payment-options">
    <label className="payment-option">
      <input
        type="radio"
        name="paymentStatus"
        value="full"
        checked={paymentStatus === 'full'}
        onChange={(e) => setPaymentStatus(e.target.value)}
      />
      <span>Full Payment Now</span>
    </label>

    <label className="payment-option">
      <input
        type="radio"
        name="paymentStatus"
        value="later"
        checked={paymentStatus === 'later'}
        onChange={(e) => setPaymentStatus(e.target.value)}
      />
      <span>Pay Later (Unpaid)</span>
    </label>
  </div>

  {(paymentStatus === 'full' || paymentStatus === 'later') && (
    <div className="payment-method-section">
      <label>Payment Method</label>
      <select
        value={paymentMethod}
        onChange={(e) => setPaymentMethod(e.target.value)}
        className="for-receipt-customerinput"
      >
        <option value="">Select Method</option>
        <option value="Cash">Cash</option>
        <option value="GCash">GCash</option>
      </select>
    </div>
  )}
</div>

<div className='for-receipt-status'>
  <h3>Extra Charges</h3>
  <div className="payment-options">
    <label className="payment-option">
      <input
        type="radio"
        name="extraCharges"
        value="discount"
        checked={extraChargeType === 'discount'}
        onChange={(e) => setExtraChargeType(e.target.value)}
      />
      <span>Discount</span>
    </label>
    <label className="payment-option">
      <input
        type="radio"
        name="extraCharges"
        value="express"
        checked={extraChargeType === 'express'}
        onChange={(e) => setExtraChargeType(e.target.value)}
      />
      <span>Express/Rush Order</span>
    </label>
    <label className="payment-option">
      <input
        type="radio"
        name="extraCharges"
        value="none"
        checked={extraChargeType === 'none'}
        onChange={(e) => setExtraChargeType(e.target.value)}
      />
      <span>No Extra Charges</span>
    </label>
  </div>

  {extraChargeType === 'discount' && (
    <div className="discount-section">
      <label>Discount Amount</label>
      <input
        type="number"
        value={discountAmount}
        onChange={(e) => setDiscountAmount(e.target.value)}
        placeholder="Enter discount amount"
        className="for-receipt-customerinput"
      />
    </div>
  )}

  {extraChargeType === 'express' && (
    <div className="express-section">
      <p>Express/Rush Order Charge: ₱100 per cycle (or 1 kg)</p>
    </div>
  )}
</div>

<div className="for-receipt-totals">
  <div className="total-row">
    <span>Subtotal:</span>
    <span>₱{calculateSubtotal().toFixed(2)}</span>
  </div>
  <div className="total-row">
    <span>Extras:</span>
    <span>₱{calculateExtras().toFixed(2)}</span>
  </div>
  <div className="total-row total-bold">
    <span>Total Payment:</span>
    <span>₱{calculateTotal().toFixed(2)}</span>
  </div>
</div>
</div>

       <div className="for-receipt-totals">
  <div className="total-row">
    <span>Subtotal:</span>
    <span>₱{calculateSubtotal().toFixed(2)}</span>
  </div>
  <div className="total-row">
    <span>Extras:</span>
    <span>₱{calculateExtras().toFixed(2)}</span>
  </div>
  <div className="total-row total-bold">
    <span>Total Payment:</span>
    <span>₱{calculateTotal().toFixed(2)}</span>
  </div>
</div>
        <div className='for-receipt-button'>
       <button className='for-receipt-clear'>
        Clear
      </button>
       <button onClick={handleCompleteTransaction} className='for-receipt-savebtn'>
       Complete and Save Transaction
      </button>
       </div>
      </div>
    </div>
    </div>
            
       </DashboardLayout>   
    );
}

export default POs;
