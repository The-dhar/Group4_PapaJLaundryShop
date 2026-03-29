import React, { useMemo, useState, useEffect } from 'react';
import { BsSearch } from 'react-icons/bs';
import DashboardLayout from '../components/dashboardlayout';
import SmallCard from '../components/smallCard';
import SmallcardModal from '../components/smallcardModal';
import CustomerModal from '../components/customerModal';
import '../styles/posstyle.css';
import Swal from 'sweetalert2';
import { useTransactions } from "../context/transactionsContext";
import { API_URL } from "../config/api";


const POs = () => {

  const { fetchTransactions } = useTransactions();

  const [selectedItem, setSelectedItem] = useState(null);
  const [selectedServices, setSelectedServices] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [extraCharges, setExtraCharges] = useState({
    discount: false,
    express: false
  });
  const [discountAmount, setDiscountAmount] = useState(0);
  const [customerFirstName, setCustomerFirstName] = useState('');
  const [customerLastName, setCustomerLastName] = useState('');
  const [customerStreet, setCustomerStreet] = useState('');
  const [customerBarangay, setCustomerBarangay] = useState('');
  const [customerCity, setCustomerCity] = useState('');
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

  if (value.trim() === "") {
    setSearchResults([]);
    return;
  }

  if (value.length < 2) {
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
    const discount = extraCharges.discount ? Number(discountAmount || 0) : 0;
    const express = extraCharges.express ? 100 : 0;
    return express - discount;
  };

  const totalPayment = subtotal + calculateExtras();

  const customerName = `${customerFirstName} ${customerLastName}`.trim();
  const customerAddress = [customerStreet, customerBarangay, customerCity]
    .map((part) => (part || '').trim())
    .filter(Boolean)
    .join(', ');

  const resetForm = () => {
    setSelectedServices([]);
    setCustomerFirstName('');
    setCustomerLastName('');
    setCustomerStreet('');
    setCustomerBarangay('');
    setCustomerCity('');
    setDueDate('');
    setExtraCharges({ discount: false, express: false });
    setDiscountAmount(0);
    setLastSavedReceipt(null);
    setSaveError('');
    setPaymentStatus('later');
    setAmountPaid('');
    setPaymentMethod('');
  };

  const printThermalReceipt = (txn) => {

  const servicesHTML = selectedServices.map(service => `
    <tr>
      <td>${service.serviceName}</td>
      <td style="text-align:center">${service.kilos}</td>
      <td style="text-align:right">₱${Number(service.total).toFixed(2)}</td>
    </tr>
  `).join("");

  const receiptHTML = `
  <html>
  <head>
  <title>Receipt</title>

  <style>
  body{
    font-family: monospace;
    width:58mm;
    padding:5px;
  }

  .center{
    text-align:center;
  }

  table{
    width:100%;
    font-size:12px;
  }

  td{
    padding:2px 0;
  }

  .line{
    border-top:1px dashed black;
    margin:5px 0;
  }

  </style>
  </head>

  <body>

  <div class="center">
    <b>Papa J's Laundry Shop</b><br/>
    Zamboanga City<br/>
    Contact: 09xx-xxx-xxxx
  </div>

  <div class="line"></div>

  Receipt: ${txn.receipt}<br/>
  Date: ${new Date().toLocaleDateString()}<br/>
  Customer: ${txn.customer_name}<br/>
  Address: ${txn.customer_address}

  <div class="line"></div>

  <table>
    <tr>
      <td>Service</td>
      <td style="text-align:center">Kg</td>
      <td style="text-align:right">Amount</td>
    </tr>

    ${servicesHTML}

  </table>

  <div class="line"></div>

  Total: ₱${Number(txn.amount).toFixed(2)}<br/>
  Paid: ₱${Number(txn.paid_amount || 0).toFixed(2)}<br/>
  Status: ${txn.payment_status}

  <div class="line"></div>

  <div class="center">
  Thank you for choosing<br/>
  Papa J's Laundry Shop!
  </div>

  </body>
  </html>
  `;

  const printWindow = window.open("", "", "width=300,height=600");

  printWindow.document.write(receiptHTML);
  printWindow.document.close();

  printWindow.focus();

  setTimeout(() => {
    printWindow.print();
    printWindow.close();
  }, 500);

};

  const handleCompleteTransaction = async () => {

    setSaveError('');

    if (!customerFirstName.trim() || !customerLastName.trim()) return setSaveError('Customer first and last name are required.');
    if (!customerStreet.trim() || !customerBarangay.trim() || !customerCity.trim()) return setSaveError('Street, barangay, and city are required.');
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
          extra_charge_type:
            extraCharges.discount && extraCharges.express
              ? 'discount+express'
              : extraCharges.discount
              ? 'discount'
              : extraCharges.express
              ? 'express'
              : 'none',
          discount_amount: extraCharges.discount ? Number(discountAmount) : 0,
          payment_status,
          payment_method: paymentMethod,
          paid_amount: Number(amountPaid) || 0,
          is_rush: extraCharges.express
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

      await fetchTransactions();
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

                    {searchResults.length > 0 && (
                      <div className="search-results">
                        {searchResults.map(customer => (
                          <div
                            key={customer.id}
                            className="search-result-item"
                            onClick={() => {
                              const parsedName = (customer.name || '').trim().split(' ');
                              const parsedFirstName = customer.first_name || parsedName[0] || '';
                              const parsedLastName = customer.last_name || parsedName.slice(1).join(' ') || '';

                              let parsedStreet = customer.street || '';
                              let parsedBarangay = customer.barangay || '';
                              let parsedCity = customer.city || '';

                              if (!parsedStreet || !parsedBarangay || !parsedCity) {
                                const parts = (customer.address || '').split(',').map((part) => part.trim());
                                parsedStreet = parsedStreet || parts[0] || '';
                                parsedBarangay = parsedBarangay || parts[1] || '';
                                parsedCity = parsedCity || parts[2] || '';
                              }

                              setCustomerFirstName(parsedFirstName);
                              setCustomerLastName(parsedLastName);
                              setCustomerStreet(parsedStreet);
                              setCustomerBarangay(parsedBarangay);
                              setCustomerCity(parsedCity);
                              setSearchResults([]);
                              setSearchTerm(`${parsedFirstName} ${parsedLastName}`.trim());
                            }}
                          >
                            {customer.name || `${customer.first_name || ''} ${customer.last_name || ''}`.trim()}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <button className="for-receipt-add-customer" onClick={() => setIsCustomerModalOpen(true)}>
                    Add Customer
                  </button>
                </div>

                <CustomerModal
                  isOpen={isCustomerModalOpen}
                  onClose={() => setIsCustomerModalOpen(false)}
                  initial={{
                    name: customerName,
                    address: customerAddress,
                    first_name: customerFirstName,
                    last_name: customerLastName,
                    street: customerStreet,
                    barangay: customerBarangay,
                    city: customerCity
                  }}
                  onSave={async ({ name, address, first_name, last_name, street, barangay, city }) => {

                    setCustomerFirstName(first_name);
                    setCustomerLastName(last_name);
                    setCustomerStreet(street);
                    setCustomerBarangay(barangay);
                    setCustomerCity(city);

                    const token = localStorage.getItem("token");

                    await fetch(`${API_URL}/customers`, {
                      method: "POST",
                      headers: {
                        "Content-Type": "application/json",
                        "Authorization": `Bearer ${token}`
                      },
                      body: JSON.stringify({
                        name: name,
                        address: address,
                        first_name: first_name,
                        last_name: last_name,
                        street: street,
                        barangay: barangay,
                        city: city
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
              <label>First Name:
                <input
                  type="text"
                  placeholder="First name"
                  className="for-receipt-customerinput"
                  value={customerFirstName}
                  onChange={e => setCustomerFirstName(e.target.value)}
                />
              </label>
              <label>Last Name:
                <input
                  type="text"
                  placeholder="Last name"
                  className="for-receipt-customerinput"
                  value={customerLastName}
                  onChange={e => setCustomerLastName(e.target.value)}
                />
              </label>
              <label>Street / Drive:
                <input
                  type="text"
                  placeholder="Street / Drive"
                  className="for-receipt-customerinput"
                  value={customerStreet}
                  onChange={e => setCustomerStreet(e.target.value)}
                />
              </label>
              <label>Barangay:
                <input
                  type="text"
                  placeholder="Barangay"
                  className="for-receipt-customerinput"
                  value={customerBarangay}
                  onChange={e => setCustomerBarangay(e.target.value)}
                />
              </label>
              <label>City:
                <input
                  type="text"
                  placeholder="City"
                  className="for-receipt-customerinput"
                  value={customerCity}
                  onChange={e => setCustomerCity(e.target.value)}
                />
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
                    <input
                      type="checkbox"
                      checked={extraCharges.discount}
                      onChange={(e) =>
                        setExtraCharges((prev) => ({
                          ...prev,
                          discount: e.target.checked
                        }))
                      }
                    />
                    <span>Discount</span>
                  </label>
                  <label className="payment-option">
                    <input
                      type="checkbox"
                      checked={extraCharges.express}
                      onChange={(e) =>
                        setExtraCharges((prev) => ({
                          ...prev,
                          express: e.target.checked
                        }))
                      }
                    />
                    <span>Express/Rush</span>
                  </label>
                  <label className="payment-option">
                    <input
                      type="checkbox"
                      checked={!extraCharges.discount && !extraCharges.express}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setExtraCharges({ discount: false, express: false });
                        }
                      }}
                    />
                    <span>No Extras</span>
                  </label>
                </div>

                {extraCharges.discount && (
                  <div className="discount-section">
                    <label>Discount Amount</label>
                    <input type="number" value={discountAmount} onChange={e => setDiscountAmount(e.target.value)} placeholder="Enter discount amount" className="for-receipt-customerinput" />
                  </div>
                )}
                {extraCharges.express && <div className="express-section"><p>Express/Rush Order Charge: ₱100 flat</p></div>}
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
