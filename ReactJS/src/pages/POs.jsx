import React, { useMemo, useState, useEffect } from 'react';
import { BsSearch } from 'react-icons/bs';
import DashboardLayout from '../components/dashboardlayout';
import SmallCard from '../components/smallCard';
import SmallcardModal from '../components/smallcardModal';
import CustomerModal from '../components/customerModal';
import '../styles/posstyle.css';
import Swal from 'sweetalert2';
import { jsPDF } from 'jspdf';
import { API_URL } from "../config/api";


const POs = () => {

  const [selectedItem, setSelectedItem] = useState(null);
  const [selectedServices, setSelectedServices] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [extraChargeType, setExtraChargeType] = useState('none');
  const [discountAmount, setDiscountAmount] = useState(0);
  const [customerName, setCustomerName] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);
  const [lastSavedReceipt, setLastSavedReceipt] = useState(null);
  const [saveError, setSaveError] = useState('');
  const [paymentStatus, setPaymentStatus] = useState('later');
  const [paymentMethod, setPaymentMethod] = useState('');
  const [amountPaid, setAmountPaid] = useState('');

  // NEW STATES (FUNCTIONAL ONLY)
  const [searchResults, setSearchResults] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    if (paymentStatus === 'full') setPaymentMethod('Cash');
    else setPaymentMethod('');
  }, [paymentStatus]);

  const laundryItems = [
    { id: 1, icon: '/pictures/clean-clothes.png', name: 'Regular Clothes' },
    { id: 2, icon: '/pictures/pants.png', name: 'White Clothes' },
    { id: 3, icon: '/pictures/blanket.png', name: 'Blankets/Bed Sheet' },
    { id: 4, icon: '/pictures/curtain.png', name: 'Curtains/Big towels' },
    { id: 5, icon: '/pictures/towel.png', name: 'Comforters' },
    { id: 6, icon: '/pictures/male-clothes.png', name: 'Drying' },
  ];

  // SEARCH FUNCTION
  const handleCustomerSearch = async (value) => {

    setSearchTerm(value);

    if (value.length < 2) {
      setSearchResults([]);
      return;
    }

    try {

      const response = await fetch(`${API_URL}/customers/search/${value}`);
      const data = await response.json();

      setSearchResults(data);

    } catch (error) {
      console.log(error);
    }
  };

  const handleAddServiceFromModal = (laundryItem, selectedTier, kilos, laundryType, extra) => {

    setSelectedServices(prev => [
      ...prev,
      {
        id: `${laundryItem.id}-${Date.now()}`,
        serviceName: laundryItem.name,
        rate: extra.computedTotal,
        kilos: kilos || 1,
        laundryType: laundryType === 'dry-only' ? 'Dry Only' : 'Wash and Fold',
        total: extra.computedTotal,
      },
    ]);

    setIsModalOpen(false);
  };

  const handleCardClick = (item) => {
    setSelectedItem(item);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedItem(null);
  };

  const removeService = (id) => {
    setSelectedServices(prev => prev.filter(svc => svc.id !== id));
  };

  const subtotal = useMemo(
    () => selectedServices.reduce((sum, s) => sum + (s.total || 0), 0),
    [selectedServices]
  );

  const totalWeight = useMemo(
    () => selectedServices.reduce((sum, s) => sum + Number(s.kilos || 0), 0),
    [selectedServices]
  );

  const calculateExtras = () => {
    if (extraChargeType === 'discount') return -Number(discountAmount || 0);
    if (extraChargeType === 'express') return 100;
    return 0;
  };

  const totalPayment = subtotal + calculateExtras();

  const resetForm = () => {
    setSelectedServices([]);
    setCustomerName('');
    setCustomerAddress('');
    setDueDate('');
    setExtraChargeType('none');
    setDiscountAmount(0);
    setLastSavedReceipt(null);
    setSaveError('');
    setPaymentStatus('later');
    setAmountPaid('');
    setPaymentMethod('');
  };

  const printThermalReceipt = (txn) => {

    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: [58, 200] });

    doc.text("Papa J's Laundry Shop", 29, 6, { align: 'center' });

    doc.text(`Receipt: ${txn.receipt}`, 2, 15);
    doc.text(`Customer: ${txn.customer_name}`, 2, 20);

    const blobUrl = doc.output('bloburl');
    window.open(blobUrl);
  };

  const handleCompleteTransaction = async () => {

    setSaveError('');

    if (!customerName.trim()) return setSaveError('Customer name is required.');
    if (!dueDate) return setSaveError('Due date is required.');
    if (selectedServices.length === 0) return setSaveError('Add at least one laundry service.');

    const servicesForSave = selectedServices.map(s => ({
      serviceName: s.serviceName,
      laundryType: s.laundryType,
      rate: s.rate,
      kilos: s.kilos,
      total: s.total
    }));

    const payment_status = paymentStatus === 'full' ? 'paid' : 'unpaid';

    try {

      const token = localStorage.getItem("token");

      const response = await fetch(`${API_URL}/transactions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
          "Accept": "application/json"
        },
        body: JSON.stringify({
          customer_name: customerName.trim(),
          customer_address: customerAddress.trim(),
          services: servicesForSave,
          weight: totalWeight,
          amount: Number(totalPayment.toFixed(2)),
          due_date: dueDate,
          extra_charge_type: extraChargeType,
          discount_amount: extraChargeType === 'discount' ? Number(discountAmount) : 0,
          payment_status,
          payment_method: paymentMethod,
          paid_amount: Number(amountPaid) || 0
        })
      });

      const newTransaction = await response.json();

      setLastSavedReceipt(newTransaction.receipt);

      printThermalReceipt(newTransaction);

      Swal.fire({
        title: "Transaction Saved!",
        html: `Receipt Number: <b>${newTransaction.receipt}</b>`,
        icon: "success",
        confirmButtonText: "Okay",
      });

      resetForm();

    } catch (error) {
      setSaveError("Failed to save transaction");
    }
  };

  return (
    <DashboardLayout>
      <div className="pos-wrapper">
        <div className="pos-grid">

          {/* Service Items Section */}
          <section className="Service-item">
            <div className="Service-item-title">Service Items</div>
            <div className="content-wrapper">
              <div className="laundry-grid">
                {laundryItems.map(item => (
                  <SmallCard key={item.id} {...item} onCardClick={() => handleCardClick(item)} />
                ))}
              </div>
            </div>
            <SmallcardModal
              isOpen={isModalOpen}
              onClose={handleCloseModal}
              item={selectedItem}
              onAdd={handleAddServiceFromModal}
            />
          </section>

          {/* Receipt Section */}
          <section className="receipt-section">
            <div className="for-receipt-information">
              <div className="for-receipt">
                <div className="for-receipt-top">
                  <div className="for-receipt-searchbar">
                    <BsSearch className="for-receipt-searchicon" />
                    <input
                      type="text"
                      placeholder="Search Names..."
                      className="for-receipt-searchinput"
                      value={searchTerm}
                      onChange={(e) => handleCustomerSearch(e.target.value)}
                    />
                  </div>
                  <button className="for-receipt-add-customer" onClick={() => setIsCustomerModalOpen(true)}>
                    Add Customer
                  </button>
                </div>

                <CustomerModal
                  isOpen={isCustomerModalOpen}
                  onClose={() => setIsCustomerModalOpen(false)}
                  initial={{ name: customerName, address: customerAddress }}
                  onSave={async ({ name, address }) => {

                    setCustomerName(name);
                    setCustomerAddress(address);

                    const token = localStorage.getItem("token");

                    await fetch(`${API_URL}/customers`, {
                      method: "POST",
                      headers: {
                        "Content-Type": "application/json",
                        "Authorization": `Bearer ${token}`
                      },
                      body: JSON.stringify({
                        name: name,
                        address: address
                      })
                    });

                  }}
                />

                <div className="for-receipt-bottom">
                  <div className="for-receipt-generator">RCPT-100001</div>
                  <div className="for-receipt-calendar">
                    <input type="date" className="for-receipt-date" value={dueDate} onChange={e => setDueDate(e.target.value)} />
                  </div>
                </div>
              </div>
            </div>

            {/* Customer Info */}
            <div className="for-receipt-output-customername">
              <label>Name:
                <input type="text" placeholder="Customer name" className="for-receipt-customerinput" value={customerName} onChange={e => setCustomerName(e.target.value)} />
              </label>
              <label>Address:
                <input type="text" placeholder="Address" className="for-receipt-customerinput" value={customerAddress} onChange={e => setCustomerAddress(e.target.value)} />
              </label>
            </div>

            {/* Payment & Extra Charges */}
            <div className="payment-extras-row">

              {/* Payment Box */}
              <div className="payment-box">
                <h3>Select Payment Information</h3>
                <div className="payment-options">
                  <label className="payment-option">
                    <input type="radio" name="paymentStatus" value="full" checked={paymentStatus === 'full'} onChange={e => setPaymentStatus(e.target.value)} />
                    <span>Full Payment Now</span>
                  </label>
                  <label className="payment-option">
                    <input type="radio" name="paymentStatus" value="later" checked={paymentStatus === 'later'} onChange={e => setPaymentStatus(e.target.value)} />
                    <span>Pay Later (Unpaid)</span>
                  </label>
                </div>

                {/* Payment method */}
                {paymentStatus === 'full' && (
                  <div className="payment-method-section">
                    <label>Payment Method</label>
                    <div className="for-receipt-customerinput">Cash</div>
                  </div>
                )}

                {/* Amount Paid */}
                {paymentStatus === 'full' && paymentMethod === 'Cash' && (
                  <div className="payment-amount-section">
                    <label>Amount Paid</label>
                    <input type="number" className="for-receipt-customerinput" placeholder="Enter amount given" value={amountPaid} onChange={e => setAmountPaid(e.target.value)} />
                    <div className="payment-summary">
                      {Number(amountPaid) >= totalPayment ? (
                        <p>Change: ₱{(Number(amountPaid) - totalPayment).toFixed(2)}</p>
                      ) : (
                        <p>Balance: ₱{(totalPayment - Number(amountPaid)).toFixed(2)}</p>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Extras Box */}
              <div className="extras-box">
                <h3>Extra Charges</h3>
                <div className="payment-options">
                  <label className="payment-option">
                    <input type="radio" name="extraCharges" value="discount" checked={extraChargeType === 'discount'} onChange={e => setExtraChargeType(e.target.value)} />
                    <span>Discount</span>
                  </label>
                  <label className="payment-option">
                    <input type="radio" name="extraCharges" value="express" checked={extraChargeType === 'express'} onChange={e => setExtraChargeType(e.target.value)} />
                    <span>Express/Rush</span>
                  </label>
                  <label className="payment-option">
                    <input type="radio" name="extraCharges" value="none" checked={extraChargeType === 'none'} onChange={e => setExtraChargeType(e.target.value)} />
                    <span>No Extras</span>
                  </label>
                </div>

                {extraChargeType === 'discount' && (
                  <div className="discount-section">
                    <label>Discount Amount</label>
                    <input type="number" value={discountAmount} onChange={e => setDiscountAmount(e.target.value)} placeholder="Enter discount amount" className="for-receipt-customerinput" />
                  </div>
                )}
                {extraChargeType === 'express' && <div className="express-section"><p>Express/Rush Order Charge: ₱100 flat</p></div>}
              </div>
            </div>
          </section>

          {/* Total Section */}
          <section className="total-section">
            <div className="for-receipt-totalitems">
              <div className="mini-item-row mini-item-header">
                <span className="mini-item-name">Service</span>
                <span className="mini-item-laundryType">Laundry Type</span>
                <span className="mini-item-rate">Rate per Kilo</span>
                <span className="mini-item-kilos">Kilos</span>

                <span />
              </div>
              {selectedServices.map(service => (
              <div key={service.id} className="mini-item-row">
               <span className="mini-item-name">{service.serviceName}</span>
               <span className="mini-item-laundryType">{service.laundryType}</span>
              <span className="mini-item-rate">₱{service.rate.toFixed(2)}</span>
               <span className="mini-item-kilos">{service.kilos} kg</span>
                <button className="mini-item-remove" onClick={() => removeService(service.id)}>✕</button>
               </div>
                ))}
            </div>

            {/* Totals */}
           {/* Totals */}
        <div className="container-information">
       <div className="for-receipt-totals">
      <div className="total-row"><span>Subtotal:</span><span>₱{subtotal.toFixed(2)}</span></div>
       <div className="total-row"><span>Extras:</span><span>₱{calculateExtras().toFixed(2)}</span></div>
       <div className="total-row"><span>Total Weight:</span><span>{totalWeight.toFixed(2)} kg</span></div>
      <div className="total-row"><span>Total Payment:</span><span>₱{totalPayment.toFixed(2)}</span></div>

       {paymentStatus === 'full' && paymentMethod === 'Cash' && (
         <>
        <div className="total-row"><span>Paid Amount:</span><span>₱{(Number(amountPaid) || 0).toFixed(2)}</span></div>
        <div className="total-row">
          {Number(amountPaid) >= totalPayment ? (
            <>
              <span>Change:</span>
              <span>₱{(Number(amountPaid) - totalPayment).toFixed(2)}</span>
            </>
          ) : (
            <>
              <span>Balance:</span>
              <span>₱{(totalPayment - Number(amountPaid)).toFixed(2)}</span>
            </>
           )}
           </div>
         </>
        )}
       </div>
    </div>
            {/* Action Buttons */}
            <div className="for-receipt-button">
              <button className="for-receipt-clear" onClick={resetForm}>Clear</button>
              <button onClick={handleCompleteTransaction} className="for-receipt-savebtn">Complete and Save Transaction</button>
            </div>

            {saveError && <p className="error-text">{saveError}</p>}
          </section>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default POs;
