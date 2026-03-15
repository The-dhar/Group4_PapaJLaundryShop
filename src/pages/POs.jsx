import React, { useMemo, useState, useEffect } from 'react';
import { BsSearch } from 'react-icons/bs';
import DashboardLayout from '../components/dashboardlayout';
import SmallCard from '../components/smallCard';
import SmallcardModal from '../components/smallcardModal';
import CustomerModal from '../components/customerModal';
import { useTransactions } from '../context/transactionsContext';
import '../styles/posstyle.css';
import Swal from 'sweetalert2';
import { jsPDF } from 'jspdf';
import { BsPencilSquare, BsTrash } from 'react-icons/bs'; 
const POs = () => {
  const { createTransaction } = useTransactions();

  // --- States ---
  const [selectedItem, setSelectedItem] = useState(null);
  const [selectedServices, setSelectedServices] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingServiceId, setEditingServiceId] = useState(null); // Tracks if we are editing an item

  const [extraChargeType, setExtraChargeType] = useState('none');
  const [discountAmount, setDiscountAmount] = useState(0);
  const [additionalAmount, setAdditionalAmount] = useState(0);
  
  // Customer States
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [street, setStreet] = useState('');
  const [barangay, setBarangay] = useState('');
  const [city, setCity] = useState('');

  const [dueDate, setDueDate] = useState('');
  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);
  const [lastSavedReceipt, setLastSavedReceipt] = useState(null);
  const [saveError, setSaveError] = useState('');
  const [paymentStatus, setPaymentStatus] = useState('later');
  const [paymentMethod, setPaymentMethod] = useState('');
  const [amountPaid, setAmountPaid] = useState('');
  const [subExtras, setSubExtras] = useState({
    extra_detergent: false,
    extra_softener: false,
    stain_removal: false,
  });

  const laundryItems = [
    { id: 1, icon: '/pictures/clean-clothes.png', name: 'Regular Clothes', pricing: [{ weight: '1–6 kilos', price: 150 }, { weight: '6.1–7 kilos', price: 175 }] },
    { id: 2, icon: '/pictures/pants.png', name: 'White Clothes', pricing: [{ weight: '1–3 kilos', price: 165 }, { weight: '3.1–6 kilos', price: 195 }] },
    { id: 3, icon: '/pictures/blanket.png', name: 'Blankets/Bed Sheet', pricing: [{ weight: '1–3 kg', price: 150 }, { weight: 'Additional', price: 50 }] },
    { id: 4, icon: '/pictures/curtain.png', name: 'Curtains/Big towels', pricing: [{ weight: '1–3 kg', price: 150 }, { weight: 'Additional', price: 50 }] },
    { id: 5, icon: '/pictures/towel.png', name: 'Comforters', pricing: [{ weight: '1–3 kg', price: 150 }, { weight: 'Additional', price: 50 }] },
    { id: 6, icon: '/pictures/male-clothes.png', name: 'Drying', pricing: [{ weight: '1–6 kilos', price: 120 }, { weight: '6.1–8 kilos', price: 150 }] },
  ];

  useEffect(() => {
    if (paymentStatus === 'full') setPaymentMethod('Cash');
    else setPaymentMethod('');
  }, [paymentStatus]);

  // --- Handlers ---

  const handleAddServiceFromModal = (laundryItem, selectedTier, kilos, laundryType, extra) => {
    const serviceData = {
      serviceName: laundryItem.name,
      rate: extra.computedTotal,
      kilos: kilos || 1,
      laundryType: laundryType === 'dry-only' ? 'Dry Only' : 'Wash and Fold',
      total: extra.computedTotal,
      unit: extra.unit,
      label: extra.label,
    };

    if (editingServiceId) {
      // UPDATE existing item
      setSelectedServices(prev => prev.map(svc => 
        svc.id === editingServiceId ? { ...svc, ...serviceData } : svc
      ));
      setEditingServiceId(null);
    } else {
      // ADD new item
      setSelectedServices(prev => [
        ...prev,
        { id: `${laundryItem.id}-${Date.now()}`, ...serviceData },
      ]);
    }
    setIsModalOpen(false);
    setSelectedItem(null);
  };

  const handleEditService = (service) => {
    const originalItem = laundryItems.find(item => item.name === service.serviceName);
    setSelectedItem({
      ...originalItem,
      initialKilos: service.kilos,
      initialType: service.laundryType === 'Dry Only' ? 'dry-only' : 'wash-fold'
    });
    setEditingServiceId(service.id);
    setIsModalOpen(true);
  };

  const handleCardClick = (item) => {
    setEditingServiceId(null); // Ensure we aren't in edit mode
    setSelectedItem(item);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedItem(null);
    setEditingServiceId(null);
  };

  const removeService = (id) => {
    setSelectedServices(prev => prev.filter(svc => svc.id !== id));
  };

  // --- Calculations ---
  const subtotal = useMemo(() => selectedServices.reduce((sum, s) => sum + (s.total || 0), 0), [selectedServices]);
  const totalWeight = useMemo(() => selectedServices.reduce((sum, s) => sum + Number(s.kilos || 0), 0), [selectedServices]);

  const calculateExtras = () => {
    let total = 0;
    if (extraChargeType === 'discount') total -= Number(discountAmount || 0);
    if (extraChargeType === 'express') total += 100;
    if (extraChargeType === 'additional') {
      total += Number(additionalAmount || 0);
      if (subExtras.extra_detergent) total += 20;
      if (subExtras.extra_softener) total += 20;
      if (subExtras.stain_removal) total += 50;
    }
    return total;
  };

  const totalPayment = subtotal + calculateExtras();

  const resetForm = () => {
    setSelectedServices([]);
    setFirstName(''); setLastName(''); setStreet(''); setBarangay(''); setCity('');
    setDueDate('');
    setExtraChargeType('none');
    setDiscountAmount(0);
    setAdditionalAmount(0);
    setPaymentStatus('later');
    setAmountPaid('');
    setSubExtras({ extra_detergent: false, extra_softener: false, stain_removal: false });
  };

  const printThermalReceipt = (txn) => {
    if (!txn) return;
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: [58, 200] });
    let y = 6;
    doc.setFont('courier', 'bold');
    doc.setFontSize(10);
    doc.text("Papa J's Laundry Shop", 29, y, { align: 'center' });
    y += 10;
    doc.setFontSize(8);
    doc.text(`Receipt: ${txn.receipt}`, 2, y);
    y += 4;
    doc.text(`Customer: ${txn.customer_name}`, 2, y);
    y += 10;
    doc.text('Total Payment:', 2, y);
    doc.text(`P${txn.amount.toFixed(2)}`, 56, y, { align: 'right' });
    window.open(doc.output('bloburl'));
  };

  const handleCompleteTransaction = () => {
    setSaveError('');
    if (!firstName.trim() || !lastName.trim()) return setSaveError('Full customer name is required.');
    if (!dueDate) return setSaveError('Due date is required.');
    if (selectedServices.length === 0) return setSaveError('Add at least one laundry service.');

    const fullName = `${firstName.trim()} ${lastName.trim()}`;
    const fullAddress = `${street.trim()}, ${barangay.trim()}, ${city.trim()}`;

    const newTransaction = createTransaction({
      customer_name: fullName,
      customer_address: fullAddress,
      services: selectedServices,
      weight: totalWeight,
      amount: Number(totalPayment.toFixed(2)),
      due_date: dueDate,
      extra_charge_type: extraChargeType,
      discount_amount: extraChargeType === 'discount' ? Number(discountAmount) : 0,
      additional_amount: extraChargeType === 'additional' ? Number(additionalAmount) : 0,
      payment_status: paymentStatus === 'full' ? 'paid' : 'unpaid',
      payment_method: paymentMethod,
      paid_amount: Number(amountPaid) || 0,
    });

    printThermalReceipt(newTransaction);
    Swal.fire({ title: "Transaction Saved!", icon: "success", width: 350 });
    resetForm();
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
                    <input type="text" placeholder="Search Names..." className="for-receipt-searchinput" />
                  </div>
                  <button className="for-receipt-add-customer" onClick={() => setIsCustomerModalOpen(true)}>Add Customer</button>
                </div>
                
                <CustomerModal
                  isOpen={isCustomerModalOpen}
                  onClose={() => setIsCustomerModalOpen(false)}
                  initial={{ firstName, lastName, street, barangay, city }}
                  onSave={(data) => {
                    setFirstName(data.firstName); setLastName(data.lastName);
                    setStreet(data.street); setBarangay(data.barangay); setCity(data.city);
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

            {/* Customer Inputs */}
            <div className="for-receipt-output-customername">
              <div style={{ display: 'flex', gap: '10px', marginBottom: '10px' }}>
                <label style={{ flex: 1 }}>First Name:
                  <input type="text" className="for-receipt-customerinput" value={firstName} onChange={e => setFirstName(e.target.value)} />
                </label>
                <label style={{ flex: 1 }}>Last Name:
                  <input type="text" className="for-receipt-customerinput" value={lastName} onChange={e => setLastName(e.target.value)} />
                </label>
              </div>
              <label>Street / Drive:
                <input type="text" className="for-receipt-customerinput" value={street} onChange={e => setStreet(e.target.value)} />
              </label>
              <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                <label style={{ flex: 1 }}>Barangay:
                  <input type="text" className="for-receipt-customerinput" value={barangay} onChange={e => setBarangay(e.target.value)} />
                </label>
                <label style={{ flex: 1 }}>City:
                  <input type="text" className="for-receipt-customerinput" value={city} onChange={e => setCity(e.target.value)} />
                </label>
              </div>
            </div>

            {/* Payment & Extras Section */}
            <div className="payment-extras-row">
              <div className="payment-box">
                <h3>Select Payment Information</h3>
                <div className="payment-options">
                  <label className="payment-option">
                    <input type="radio" checked={paymentStatus === 'full'} onChange={() => setPaymentStatus('full')} />
                    <span>Full Payment Now</span>
                  </label>
                  <label className="payment-option">
                    <input type="radio" checked={paymentStatus === 'later'} onChange={() => setPaymentStatus('later')} />
                    <span>Pay Later</span>
                  </label>
                </div>
                {paymentStatus === 'full' && (
                  <div className="payment-amount-section">
                    <label>Amount Paid</label>
                    <input type="number" className="for-receipt-customerinput" value={amountPaid} onChange={e => setAmountPaid(e.target.value)} />
                  </div>
                )}
              </div>

              <div className="extras-box">
                <h3>Extra Charges</h3>
                <div className="payment-options">
                  {['discount', 'express', 'additional', 'none'].map((type) => (
                    <label key={type} className="payment-option">
                      <input type="checkbox" checked={extraChargeType === type} onChange={() => setExtraChargeType(type)} />
                      <span style={{ textTransform: 'capitalize' }}>{type === 'express' ? 'Rush' : type}</span>
                    </label>
                  ))}
                </div>

                {extraChargeType === 'additional' && (
                  <div className="sub-extras-container" style={{ marginLeft: '10px', padding: '5px', borderLeft: '2px solid #ddd' }}>
                    {Object.keys(subExtras).map((key) => (
                      <label key={key} className="payment-option" style={{ display: 'block' }}>
                        <input type="checkbox" checked={subExtras[key]} onChange={() => setSubExtras(prev => ({ ...prev, [key]: !prev[key] }))} />
                        <span style={{ marginLeft: '5px' }}>{key.replace('_', ' ')}</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </section>

          {/* Total Section */}
          <section className="total-section">
            <div className="for-receipt-totalitems">
              <div className="mini-item-row mini-item-header">
                <span className="mini-item-name">Service</span>
                <span className="mini-item-laundryType">Laundry Type</span>
                <span className="mini-item-rate">Rate</span>
                <span className="mini-item-kilos">Kilos</span>
                <span className="mini-item-actions">Actions</span>
              </div>
              {selectedServices.map(service => (
                <div key={service.id} className="mini-item-row">
                  <span className="mini-item-name">{service.serviceName}</span>
                  <span className="mini-item-laundryType">{service.laundryType}</span>
                  <span className="mini-item-rate">P{service.rate.toFixed(2)}</span>
                  <span className="mini-item-kilos">{service.kilos} kg</span>
                  <div className="mini-item-actions">
                    <button className="mini-item-edit" onClick={() => handleEditService(service)} title="Edit"><BsPencilSquare /></button>
                    <button className="mini-item-remove" onClick={() => removeService(service.id)} title="Remove"><BsTrash /></button>
                  </div>
                </div>
              ))}
            </div>

            <div className="container-information">
              <div className="for-receipt-totals">
                <div className="total-row"><span>Subtotal:</span><span>P{subtotal.toFixed(2)}</span></div>
                <div className="total-row"><span>Extras:</span><span>P{calculateExtras().toFixed(2)}</span></div>
                <div className="total-row"><span>Total Payment:</span><strong>P{totalPayment.toFixed(2)}</strong></div>
              </div>
            </div>

            <div className="for-receipt-button">
              <button className="for-receipt-clear" onClick={resetForm}>Clear</button>
              <button onClick={handleCompleteTransaction} className="for-receipt-savebtn">Complete and Save</button>
            </div>
          </section>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default POs;