import React, { useMemo, useState } from 'react';
import { BsSearch } from 'react-icons/bs';
import DashboardLayout from '../components/dashboardlayout';
import SmallCard from '../components/smallCard';
import SmallcardModal from '../components/smallcardModal';
import CustomerModal from '../components/customerModal';
import { useTransactions } from '../context/transactionsContext';
import '../styles/posstyle.css';
import Swal from 'sweetalert2';
import { jsPDF } from 'jspdf';

const POs = () => {
  const { createTransaction } = useTransactions();
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
        id: `${laundryItem.id}-${Date.now()}`,
        serviceName: laundryItem.name,
        rate: laundryItem.price,
        kilos: laundryItem.kilos || 1,
        laundryType: laundryItem.laundryType || 'standard',
        total: (laundryItem.kilos || 1) * laundryItem.price,
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

  const removeService = (id) => {
    setSelectedServices((prev) => prev.filter((svc) => svc.id !== id));
  };

  const subtotal = useMemo(
    () => selectedServices.reduce((sum, service) => sum + (service.total || 0), 0),
    [selectedServices]
  );

  const totalWeight = useMemo(
    () => selectedServices.reduce((sum, service) => sum + Number(service.kilos || 0), 0),
    [selectedServices]
  );

  const calculateExtras = () => {
    if (extraChargeType === 'discount') {
      return -Number(discountAmount || 0);
    }
    if (extraChargeType === 'express') {
      return 100;
    }
    return 0;
  };

  const totalPayment = subtotal + calculateExtras();

  // Generate 58mm thermal-style PDF receipt (same style as Receiptmanagement)
  const printThermalReceipt = (txn) => {
    if (!txn) return;

    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: [58, 200], // 58mm width, variable length
    });

    let y = 6;
    const centerX = 29;

    const services = Array.isArray(txn.services) ? txn.services : [];
    const subtotalValue = services.reduce((sum, s) => sum + (s.total || 0), 0);
    const totalValue = Number(txn.amount || 0);
    const paidValue = Number(txn.paid_amount || 0);
    const diffValue = paidValue - totalValue;

    // HEADER
    doc.setFont('courier', 'bold');
    doc.setFontSize(10);
    doc.text("Papa J's Laundry Shop", centerX, y, { align: 'center' });
    y += 4;

    doc.setFont('courier', 'normal');
    doc.setFontSize(8);
    doc.text('123 Sample Street, Barangay, City', centerX, y, { align: 'center' });
    y += 3;
    doc.text('Contact: 09xx-xxx-xxxx', centerX, y, { align: 'center' });
    y += 3;
    doc.text('TIN: 123-456-789', centerX, y, { align: 'center' });
    y += 3;

    doc.line(2, y, 56, y);
    y += 3;

    // META
    doc.text(`Receipt: ${txn.receipt}`, 2, y);
    if (txn.due_date) {
      doc.text(String(txn.due_date), 56, y, { align: 'right' });
    }
    y += 4;

    doc.text(`Customer: ${txn.customer_name}`, 2, y);
    y += 4;
    if (txn.customer_address) {
      doc.text(`Address: ${txn.customer_address}`, 2, y);
      y += 4;
    }

    doc.line(2, y, 56, y);
    y += 3;

    // SERVICES HEADER
    doc.setFont('courier', 'bold');
    doc.text('Srv', 2, y);
    doc.text('Kg', 30, y, { align: 'center' });
    doc.text('Amt', 56, y, { align: 'right' });
    y += 3;
    doc.line(2, y, 56, y);
    y += 3;

    // SERVICES LIST
    doc.setFont('courier', 'normal');
    services.forEach((svc) => {
      const name = svc.serviceName || '';
      const rate = svc.rate ?? 0;
      const kilos = svc.kilos ?? 0;
      const total = svc.total ?? 0;

      doc.text(name.substring(0, 16), 2, y);
      doc.text(String(kilos), 30, y, { align: 'center' });
      doc.text(`₱${total.toFixed(2)}`, 56, y, { align: 'right' });
      y += 3;

      doc.setFontSize(7);
      doc.text(`@ ₱${rate.toFixed(2)}`, 2, y);
      doc.setFontSize(8);
      y += 3;
    });

    doc.line(2, y, 56, y);
    y += 3;

    // TOTALS
    doc.text('Subtotal', 2, y);
    doc.text(`₱${subtotalValue.toFixed(2)}`, 56, y, { align: 'right' });
    y += 3;

    if (txn.extra_charge_type === 'discount') {
      doc.text('Discount', 2, y);
      doc.text(`-₱${(txn.discount_amount || 0).toFixed(2)}`, 56, y, { align: 'right' });
      y += 3;
    }

    if (txn.extra_charge_type === 'express') {
      doc.text('Express', 2, y);
      doc.text('+₱100.00', 56, y, { align: 'right' });
      y += 3;
    }

    doc.setFont('courier', 'bold');
    doc.text('Total', 2, y);
    doc.text(`₱${totalValue.toFixed(2)}`, 56, y, { align: 'right' });
    y += 4;

    doc.setFont('courier', 'normal');
    doc.line(2, y, 56, y);
    y += 3;

    // PAYMENT INFO (same style as Receiptmanagement)
    doc.text('Payment:', 2, y);
    doc.text(txn.payment_method || '—', 56, y, { align: 'right' });
    y += 3;

    doc.text('Paid:', 2, y);
    doc.text(`₱${paidValue.toFixed(2)}`, 56, y, { align: 'right' });
    y += 3;

    if (paidValue > 0) {
      const label = diffValue >= 0 ? 'Change:' : 'Balance:';
      doc.text(label, 2, y);
      doc.text(`₱${Math.abs(diffValue).toFixed(2)}`, 56, y, { align: 'right' });
      y += 3;
    }

    doc.text('Status:', 2, y);
    doc.text(String(txn.inventory_status || ''), 56, y, { align: 'right' });
    y += 4;

    doc.line(2, y, 56, y);
    y += 4;

    // FOOTER
    doc.setFontSize(7);
    doc.text('Thank you for choosing', centerX, y, { align: 'center' });
    y += 3;
    doc.text("Papa J's Laundry Shop!", centerX, y, { align: 'center' });

    const blobUrl = doc.output('bloburl');
    window.open(blobUrl);
  };

  const resetForm = () => {
    setSelectedServices([]);
    setCustomerName('');
    setCustomerAddress('');
    setDueDate('');
    setExtraChargeType('none');
    setDiscountAmount(0);
    setLastSavedReceipt(null);
    setSaveError('');
  };

  const handleCompleteTransaction = () => {
    setSaveError('');

    if (!customerName.trim()) {
      setSaveError('Customer name is required.');
      return;
    }
    if (!dueDate) {
      setSaveError('Due date is required.');
      return;
    }
    if (selectedServices.length === 0) {
      setSaveError('Add at least one laundry service.');
      return;
    }

    // clone services to avoid shared references
    const servicesForSave = selectedServices.map((s) => ({ ...s }));

    const payment_status = paymentStatus === 'full' ? 'paid' : 'unpaid';
    const paid_amount = Number(amountPaid) || 0;

    const newTransaction = createTransaction({
      customer_name: customerName.trim(),
      customer_address: customerAddress.trim(),
      services: servicesForSave,
      weight: totalWeight,
      amount: Number(totalPayment.toFixed(2)),
      due_date: dueDate,
      extra_charge_type: extraChargeType,
      discount_amount: extraChargeType === 'discount' ? Number(discountAmount) : 0,
      // optional payment fields
      payment_status,
      payment_method: paymentMethod,
      paid_amount,
    });

    setLastSavedReceipt(newTransaction.receipt);
    // Generate thermal-style PDF receipt
    printThermalReceipt(newTransaction);
   Swal.fire({
  title: "Transaction Saved!",
  html: `Receipt Number: <b>${newTransaction.receipt}</b>`,
  icon: "success",
  confirmButtonText: "Okay",
  width: 350,
  background: "#ffffff",
  confirmButtonColor: "#4CAF50",
});

    resetForm();
  };

  return (
    <DashboardLayout>
      <div className="pos-wrapper">
        <div className="pos-grid">
          <section className="Service-item">
            <div className="Service-item-title">Service Items</div>
            <div className="content-wrapper">
              <div className="laundry-grid">
                {laundryItems.map((item) => (
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

          <section className="receipt-section">
            <div className="for-receipt-information">
              <div className="for-receipt">
                <div className="for-receipt-top">
                  <div className="for-receipt-searchbar">
                    <BsSearch className="for-receipt-searchicon" />
                    <input type="text" placeholder="Search Names..." className="for-receipt-searchinput" />
                  </div>
                  <button
                    className="for-receipt-add-customer"
                    onClick={() => setIsCustomerModalOpen(true)}
                  >
                    Add Customer
                  </button>
                </div>
              
                <CustomerModal
                  isOpen={isCustomerModalOpen}
                  onClose={() => setIsCustomerModalOpen(false)}
                  initial={{ name: customerName, address: customerAddress }}
                  onSave={({ name, address }) => {
                    setCustomerName(name);
                    setCustomerAddress(address);
                  }}
                />
                   <div className="for-receipt-bottom">
                  <div className="for-receipt-generator">
                 RCPT-100001
                 </div>
                  <div className="for-receipt-calendar">
                    <input
                      type="date"
                      className="for-receipt-date"
                      value={dueDate}
                      onChange={(e) => setDueDate(e.target.value)}
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="for-receipt-output-customername">
              <label>
                Name:
                <input
                  type="text"
                  placeholder="Customer name"
                  className="for-receipt-customerinput"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                />
              </label>
              <label>
                Address:
                <input
                  type="text"
                  placeholder="Address"
                  className="for-receipt-customerinput"
                  value={customerAddress}
                  onChange={(e) => setCustomerAddress(e.target.value)}
                />
              </label>
            </div>

            <div className="for-receipt-totalitems">
              <div className="mini-item-row mini-item-header">
                <span className="mini-item-name">Service</span>
                <span className="mini-item-laundryType">Laundry Type</span>
                <span className="mini-item-rate">Rate per Kilo</span>
                <span className="mini-item-kilos">Kilos</span>
                <span className="mini-item-total">Total</span>
                <span />
              </div>
              {selectedServices.map((service) => (
                <div key={service.id} className="mini-item-row">
                  <span className="mini-item-name">{service.serviceName}</span>
                  <span className="mini-item-laundryType">{service.laundryType}</span>
                  <span className="mini-item-rate">₱ {service.rate.toFixed(2)}</span>
                  <span className="mini-item-kilos">{service.kilos} kg</span>
                  <span className="mini-item-total">₱ {service.total.toFixed(2)}</span>
                  <button className="mini-item-remove" onClick={() => removeService(service.id)}>
                    ✕
                  </button>
                </div>
              ))}
            </div>

            {/* Payment & Extra Charges Section - Two Column Layout */}
            <div className="payment-extras-row">
              {/* Payment Information Box */}
              <div className="payment-box">
                <h3>Select Payment Information</h3>
                
                <div className="payment-options">
                  <label className="payment-option">
                    <input
                      type="radio"
                      name="paymentStatus"
                      value="full"
                      checked={paymentStatus === 'full'}
                      onChange={(e) => {
                        setPaymentStatus(e.target.value);
                        setPaymentMethod('');
                        setAmountPaid('');
                      }}
                    />
                    <span>Full Payment Now</span>
                  </label>

                  <label className="payment-option">
                    <input
                      type="radio"
                      name="paymentStatus"
                      value="later"
                      checked={paymentStatus === 'later'}
                      onChange={(e) => {
                        setPaymentStatus(e.target.value);
                        setPaymentMethod('');
                        setAmountPaid('');
                      }}
                    />
                    <span>Pay Later (Unpaid)</span>
                  </label>
                </div>

                {/* Payment method appears only if Full selected */}
                {paymentStatus === 'full' && (
                <div className="payment-method-section">
               <label>Payment Method</label>

                      {/* Fixed text */}
                 <div className="for-receipt-customerinput">
                  Cash
                 </div>

                         {/* Set payment method automatically */}
                   {paymentMethod !== "Cash" && setPaymentMethod("Cash")}
                     </div>
                    )}
                {/* Show cash input only if Full Payment + Cash selected */}
                {paymentStatus === 'full' && paymentMethod === 'Cash' && (
                  <div className="payment-amount-section">
                    <label>Amount Paid</label>
                    <input
                      type="number"
                      className="for-receipt-customerinput"
                      placeholder="Enter amount given"
                      value={amountPaid}
                      onChange={(e) => setAmountPaid(e.target.value)}
                    />

                    {/* Auto compute Change or Balance */}
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

              {/* Extra Charges Box */}
              <div className="extras-box">
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
                    <span>Express/Rush</span>
                  </label>
                  <label className="payment-option">
                    <input
                      type="radio"
                      name="extraCharges"
                      value="none"
                      checked={extraChargeType === 'none'}
                      onChange={(e) => setExtraChargeType(e.target.value)}
                    />
                    <span>No Extras</span>
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
                    <p>Express/Rush Order Charge: ₱100 flat</p>
                  </div>
                )}
              </div>
            </div>

            <div className="container-information">
              <div className="for-receipt-totals">
                <div className="total-row">
                  <span>Subtotal:</span>
                  <span>₱{subtotal.toFixed(2)}</span>
                </div>
                <div className="total-row">
                  <span>Extras:</span>
                  <span>₱{calculateExtras().toFixed(2)}</span>
                </div>
                <div className="total-row">
                  <span>Total Weight:</span>
                  <span>{totalWeight.toFixed(2)} kg</span>
                </div>
                <div className="total-row">
                  <span>Total Payment:</span>
                  <span>₱{totalPayment.toFixed(2)}</span>
                </div>

                {/* If paying now with Cash, show paid amount and change/balance */}
                {paymentStatus === 'full' && paymentMethod === 'Cash' && (
                  <>
                    <div className="total-row">
                      <span>Paid Amount:</span>
                      <span>₱{(Number(amountPaid) || 0).toFixed(2)}</span>
                    </div>

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

            <div className="for-receipt-button">
              <button className="for-receipt-clear" onClick={resetForm}>
                Clear
              </button>
              <button onClick={handleCompleteTransaction} className="for-receipt-savebtn">
                Complete and Save Transaction
              </button>
            </div>
            {saveError && <p className="error-text">{saveError}</p>}
          </section>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default POs;