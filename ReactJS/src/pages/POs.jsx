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

  const [activeExtras, setActiveExtras] = useState({ discount: false, express: false });
  const [discountAmount, setDiscountAmount] = useState(0);
  
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
  const [isSaving, setIsSaving] = useState(false);
  const [subExtras, setSubExtras] = useState({
    extra_detergent: 0,
    extra_softener: 0,
    stain_removal: false,
  });
  const [pastSearches, setPastSearches] = useState([]);

  useEffect(() => {
    setPastSearches(JSON.parse(localStorage.getItem('pastSearches') || '[]'));
  }, []);

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

  const handleSearchKeyDown = (e) => {
    if (e.key === 'Enter' && e.target.value.trim()) {
      const val = e.target.value.trim();
      if (!pastSearches.includes(val)) {
        const newSearches = [val, ...pastSearches].slice(0, 10);
        setPastSearches(newSearches);
        localStorage.setItem('pastSearches', JSON.stringify(newSearches));
      }
    }
  };

  const handleAddServiceFromModal = (laundryItem, selectedTier, kilos, laundryType, extra, notes) => {
    const serviceData = {
      serviceName: laundryItem.name,
      rate: extra.computedTotal,
      kilos: kilos || 1,
      laundryType: laundryType === 'dry-only' ? 'Dry Only' : 'Wash and Fold',
      total: extra.computedTotal,
      unit: extra.unit,
      label: extra.label,
      notes: notes || '',
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
      initialType: service.laundryType === 'Dry Only' ? 'dry-only' : 'wash-fold',
      initialNotes: service.notes
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
    if (activeExtras.discount) total -= Number(discountAmount || 0);
    if (activeExtras.express) total += 100;
    total += Number(subExtras.extra_detergent || 0) * 20;
    total += Number(subExtras.extra_softener || 0) * 20;
    if (subExtras.stain_removal) total += 50;
    return total;
  };

  const totalPayment = subtotal + calculateExtras();

  const resetForm = () => {
    setSelectedServices([]);
    setFirstName(''); setLastName(''); setStreet(''); setBarangay(''); setCity('');
    setDueDate('');
    setActiveExtras({ discount: false, express: false });
    setDiscountAmount(0);
    setPaymentStatus('later');
    setAmountPaid('');
    setSubExtras({ extra_detergent: 0, extra_softener: 0, stain_removal: false });
  };

  const printThermalReceipt = (txn) => {
    if (!txn) return;
    
    if (txn.payment_status === 'unpaid') {
      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: [58, 90] });
      let y = 8;
      const centerText = (text, yPos, size = 8) => {
        doc.setFontSize(size);
        doc.text(text, 29, yPos, { align: 'center' });
      };

      doc.setFont('courier', 'bold');
      centerText("PAPA J'S LAUNDRY SHOP", y, 10);
      y += 4;
      doc.setLineDash([1, 1]); doc.line(2, y, 56, y); doc.setLineDash([]); y += 5;
      
      centerText("CLAIM STUB", y, 10);
      y += 6;

      doc.setFont('courier', 'normal');
      doc.setFontSize(8);
      doc.text(`RCPT#: ${txn.receipt || 'RCPT-100001'}`, 2, y); y += 4;
      doc.text(`DATE: ${new Date(txn.created_at || Date.now()).toLocaleDateString()}`, 2, y); y += 4;
      doc.text(`DUE: ${txn.due_date}`, 2, y); y += 6;
      
      doc.text(`NAME: ${txn.customer_name}`, 2, y); y += 4;
      doc.text(`QTY: ${txn.weight}kg`, 2, y); y += 6;

      doc.setFont('courier', 'bold');
      doc.text(`TOTAL DUE: P${(txn.amount || 0).toFixed(2)}`, 2, y); y += 4;
      doc.text(`STATUS: ${String(txn.payment_status || 'unpaid').toUpperCase()}`, 2, y); y += 6;

      doc.setLineDash([1, 1]); doc.line(2, y, 56, y); doc.setLineDash([]); y += 5;
      
      doc.setFont('courier', 'normal');
      centerText("Present this upon payment", y, 8);

      const blobUrl = doc.output('bloburl');
      window.open(blobUrl);
      return;
    }

    
    const extrasActive = txn.active_extras || {};
    const slist = txn.sub_extras || {};
    
    let extraHeight = 0;
    if (extrasActive.express || (txn.extra_charge_type && txn.extra_charge_type.includes('express'))) extraHeight += 4;
    if (slist.extra_detergent) extraHeight += 4;
    if (slist.extra_softener) extraHeight += 4;
    if (slist.stain_removal) extraHeight += 4;
    if (txn.additional_amount > 0) extraHeight += 4;
    if (txn.discount_amount > 0) extraHeight += 4;

    const baseHeight = 130; 
    const itemHeight = txn.services.length * 12; 
    const dynamicHeight = baseHeight + itemHeight + extraHeight;
    
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: [58, dynamicHeight] });
    let y = 8;
    
    const centerText = (text, yPos, size = 8) => {
      doc.setFontSize(size);
      doc.text(text, 29, yPos, { align: 'center' });
    };

    // Header
    doc.setFont('courier', 'bold');
    centerText("PAPA J'S LAUNDRY SHOP", y, 10);
    y += 4;
  
    
    y += 6;
    doc.setLineDash([1, 1]);
    doc.line(2, y, 56, y);
    doc.setLineDash([]);
    
    y += 5;
    doc.setFont('courier', 'bold');
    doc.setFontSize(8);
    doc.text(`RCPT NO : ${txn.receipt || 'RCPT-100001'}`, 2, y);
    y += 4;
    doc.setFont('courier', 'normal');
    doc.text(`DATE    : ${new Date().toLocaleDateString()}`, 2, y);
    y += 4;
    doc.text(`DUE DATE: ${txn.due_date}`, 2, y);
    
    y += 4;
    doc.text(`NAME    : ${txn.customer_name}`, 2, y);
    y += 4;
    
    const splitAddress = doc.splitTextToSize(`ADDRESS : ${txn.customer_address}`, 54);
    doc.text(splitAddress, 2, y);
    y += (splitAddress.length * 4);

    y += 2;
    doc.setLineDash([1, 1]);
    doc.line(2, y, 56, y);
    doc.setLineDash([]);
    y += 5;

    // Items
    doc.setFont('courier', 'bold');
    doc.text("QTY/KG", 2, y);
    doc.text("ITEM", 16, y);
    doc.text("TOTAL", 56, y, { align: 'right' });
    y += 2;
    doc.line(2, y, 56, y);
    doc.setLineDash([]);
    y += 4;

    doc.setFont('courier', 'normal');
    let computedSubtotal = 0;
    txn.services.forEach(svc => {
      doc.setFontSize(8);
      doc.text(`${svc.kilos}kg`, 2, y);
      
      const itemName = doc.splitTextToSize(`${svc.serviceName}`, 28);
      doc.text(itemName, 16, y);
      
      doc.text(`P${svc.rate.toFixed(2)}`, 56, y, { align: 'right' });
      computedSubtotal += svc.rate;
      y += (itemName.length * 4);
      
      if (svc.notes) {
        doc.setFontSize(7);
        const notes = doc.splitTextToSize(`Note: ${svc.notes}`, 40);
        doc.text(notes, 16, y);
        y += (notes.length * 3.5);
      }
    });

    y += 2;
    doc.setLineDash([1, 1]);
    doc.line(2, y, 56, y);
    doc.setLineDash([]);
    y += 5;

    // Totals and Extras
    doc.setFontSize(8);
    doc.text("Subtotal:", 2, y);
    doc.text(`P${computedSubtotal.toFixed(2)}`, 56, y, { align: 'right' });
    y += 4;

    if (extrasActive.express || (txn.extra_charge_type && txn.extra_charge_type.includes('express'))) {
      doc.text("Rush Charge:", 2, y);
      doc.text("P100.00", 56, y, { align: 'right' });
      y += 4;
    }

    if (slist.extra_detergent > 0) {
      doc.text(`Extra Detergent (x${slist.extra_detergent}):`, 2, y);
      doc.text(`P${(20 * slist.extra_detergent).toFixed(2)}`, 56, y, { align: 'right' });
      y += 4;
    } else if (slist.extra_detergent === true) {
      doc.text("Extra Detergent:", 2, y);
      doc.text("P20.00", 56, y, { align: 'right' });
      y += 4;
    }

    if (slist.extra_softener > 0) {
      doc.text(`Extra Softener (x${slist.extra_softener}):`, 2, y);
      doc.text(`P${(20 * slist.extra_softener).toFixed(2)}`, 56, y, { align: 'right' });
      y += 4;
    } else if (slist.extra_softener === true) {
      doc.text("Extra Softener:", 2, y);
      doc.text("P20.00", 56, y, { align: 'right' });
      y += 4;
    }

    if (slist.stain_removal) {
      doc.text("Stain Removal:", 2, y);
      doc.text("P50.00", 56, y, { align: 'right' });
      y += 4;
    }

    if (txn.additional_amount > 0) {
      doc.text("Other Additional:", 2, y);
      doc.text(`P${txn.additional_amount.toFixed(2)}`, 56, y, { align: 'right' });
      y += 4;
    }

    if (txn.discount_amount > 0) {
      doc.text("Discount:", 2, y);
      doc.text(`-P${txn.discount_amount.toFixed(2)}`, 56, y, { align: 'right' });
      y += 4;
    }

    y += 2;
    doc.setFont('courier', 'bold');
    doc.setFontSize(10);
    doc.text("TOTAL PAYMENT:", 2, y);
    doc.text(`P${txn.amount.toFixed(2)}`, 56, y, { align: 'right' });
    
    y += 6;
    doc.setFont('courier', 'normal');
    doc.setFontSize(8);
    
    // Payment Status Information
    doc.text("PAYMENT STATUS:", 2, y);
    doc.setFont('courier', 'bold');
    doc.text(String(txn.payment_status || 'unpaid').toUpperCase(), 56, y, { align: 'right' });
    y += 4;
    
    if (txn.payment_status === 'paid') {
      doc.setFont('courier', 'normal');
      doc.text("Amount Paid:", 2, y);
      doc.text(`P${txn.paid_amount.toFixed(2)}`, 56, y, { align: 'right' });
      y += 4;
      
      const change = txn.paid_amount - txn.amount;
      if (change > 0) {
        doc.text("Change:", 2, y);
        doc.text(`P${change.toFixed(2)}`, 56, y, { align: 'right' });
        y += 4;
      }
    } else {
      doc.setFont('courier', 'bold');
      doc.text("BALANCE DUE:", 2, y);
      doc.text(`P${txn.amount.toFixed(2)}`, 56, y, { align: 'right' });
      y += 4;
    }

    y += 4;
    doc.setLineDash([1, 1]);
    doc.line(2, y, 56, y);
    doc.setLineDash([]);
    y += 6;

    // Footer
    centerText("Thank you for choosing", y, 7);
    y += 4;
    centerText("Papa J's Laundry Shop!", y, 7);
    y += 6;
    
    doc.setFont('courier', 'italic');
    doc.setFontSize(6);
    centerText("This is not an official receipt.", y, 6);

    window.open(doc.output('bloburl'));
  };

  const handleCompleteTransaction = async () => {
    setSaveError('');
    if (!firstName.trim() || !lastName.trim() || !street.trim() || !barangay.trim() || !city.trim()) {
      Swal.fire({ title: "Missing Information", text: "Please complete all customer details.", icon: "warning", width: 350 });
      return;
    }
    if (!dueDate) {
      Swal.fire({ title: "Missing Information", text: "Due date is required.", icon: "warning", width: 350 });
      return;
    }
    if (selectedServices.length === 0) {
      Swal.fire({ title: "Missing Information", text: "Add at least one laundry service.", icon: "warning", width: 350 });
      return;
    }

    const fullName = `${firstName.trim()} ${lastName.trim()}`;
    const fullAddress = `${street.trim()}, ${barangay.trim()}, ${city.trim()}`;

    try {
      setIsSaving(true);
      const newTransaction = await createTransaction({
        customer_name: fullName,
        customer_address: fullAddress,
        services: selectedServices,
        weight: totalWeight,
        amount: Number(totalPayment.toFixed(2)),
        due_date: dueDate,
        extra_charge_type: Object.keys(activeExtras).filter(k => activeExtras[k]).join(', ') || 'none',
        discount_amount: activeExtras.discount ? Number(discountAmount) : 0,
        additional_amount: 0,
        active_extras: activeExtras,
        sub_extras: subExtras,
        payment_status: paymentStatus === 'full' ? 'paid' : 'unpaid',
        payment_method: paymentMethod,
        paid_amount: Number(amountPaid) || 0,
      });

      printThermalReceipt(newTransaction);
      Swal.fire({ title: "Transaction Saved!", icon: "success", width: 350 });
      resetForm();
    } catch (error) {
      Swal.fire({
        title: "Save failed",
        text: error?.message || "Unable to save transaction. Please check backend CORS/deploy status and try again.",
        icon: "error",
        width: 420
      });
    } finally {
      setIsSaving(false);
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
                      list="past-searches"
                      onKeyDown={handleSearchKeyDown}
                    />
                    <datalist id="past-searches">
                      {pastSearches.map((search, i) => (
                        <option key={i} value={search} />
                      ))}
                    </datalist>
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
                  {['discount', 'express'].map((type) => (
                    <label key={type} className="payment-option">
                      <input 
                        type="checkbox" 
                        checked={activeExtras[type]} 
                        onChange={() => setActiveExtras(prev => ({ ...prev, [type]: !prev[type] }))} 
                      />
                      <span style={{ textTransform: 'capitalize' }}>{type === 'express' ? 'Rush' : type}</span>
                    </label>
                  ))}

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                    <label className="payment-option" style={{ margin: 0, cursor: 'pointer' }}>
                      <input 
                        type="checkbox" 
                        checked={subExtras.extra_detergent > 0} 
                        onChange={(e) => setSubExtras(prev => ({ ...prev, extra_detergent: e.target.checked ? 1 : 0 }))} 
                      />
                      <span>Extra Detergent (P20)</span>
                    </label>
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                      <button 
                        type="button"
                        onClick={() => setSubExtras(prev => ({ ...prev, extra_detergent: Math.max(0, prev.extra_detergent - 1) }))} 
                        style={{ background: '#6c757d', color: '#fff', border: 'none', width: '22px', height: '22px', cursor: 'pointer', fontSize: '12px', borderRadius: '4px 0 0 4px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                      >-</button>
                      <input 
                        type="text" 
                        value={subExtras.extra_detergent} 
                        readOnly 
                        style={{ width: '30px', height: '22px', textAlign: 'center', border: '1px solid #ccc', borderLeft: 'none', borderRight: 'none', boxSizing: 'border-box', fontSize: '12px', margin: 0, outline: 'none' }} 
                      />
                      <button 
                        type="button"
                        onClick={() => setSubExtras(prev => ({ ...prev, extra_detergent: prev.extra_detergent + 1 }))} 
                        style={{ background: '#6c757d', color: '#fff', border: 'none', width: '22px', height: '22px', cursor: 'pointer', fontSize: '12px', borderRadius: '0 4px 4px 0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                      >+</button>
                    </div>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                    <label className="payment-option" style={{ margin: 0, cursor: 'pointer' }}>
                      <input 
                        type="checkbox" 
                        checked={subExtras.extra_softener > 0} 
                        onChange={(e) => setSubExtras(prev => ({ ...prev, extra_softener: e.target.checked ? 1 : 0 }))} 
                      />
                      <span>Extra Softener (P20)</span>
                    </label>
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                      <button 
                        type="button"
                        onClick={() => setSubExtras(prev => ({ ...prev, extra_softener: Math.max(0, prev.extra_softener - 1) }))} 
                        style={{ background: '#6c757d', color: '#fff', border: 'none', width: '22px', height: '22px', cursor: 'pointer', fontSize: '12px', borderRadius: '4px 0 0 4px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                      >-</button>
                      <input 
                        type="text" 
                        value={subExtras.extra_softener} 
                        readOnly 
                        style={{ width: '30px', height: '22px', textAlign: 'center', border: '1px solid #ccc', borderLeft: 'none', borderRight: 'none', boxSizing: 'border-box', fontSize: '12px', margin: 0, outline: 'none' }} 
                      />
                      <button 
                        type="button"
                        onClick={() => setSubExtras(prev => ({ ...prev, extra_softener: prev.extra_softener + 1 }))} 
                        style={{ background: '#6c757d', color: '#fff', border: 'none', width: '22px', height: '22px', cursor: 'pointer', fontSize: '12px', borderRadius: '0 4px 4px 0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                      >+</button>
                    </div>
                  </div>

                  <label className="payment-option" style={{ cursor: 'pointer' }}>
                    <input type="checkbox" checked={subExtras.stain_removal} onChange={() => setSubExtras(prev => ({ ...prev, stain_removal: !prev.stain_removal }))} />
                    <span>Stain Removal (P50)</span>
                  </label>
                </div>

                {activeExtras.discount && (
                  <div className="payment-amount-section" style={{ marginLeft: '10px', marginTop: '10px' }}>
                    <label>Amount to Discount</label>
                    <input type="number" className="for-receipt-customerinput" value={discountAmount} onChange={e => setDiscountAmount(e.target.value)} />
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
                <span className="mini-item-notes">Notes</span>
                <span className="mini-item-actions">Actions</span>
              </div>
              {selectedServices.map(service => (
                <div key={service.id} className="mini-item-row">
                  <span className="mini-item-name">{service.serviceName}</span>
                  <span className="mini-item-laundryType">{service.laundryType}</span>
                  <span className="mini-item-rate">P{service.rate.toFixed(2)}</span>
                  <span className="mini-item-kilos">{service.kilos} kg</span>
                  <span className="mini-item-notes" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={service.notes || ''}>{service.notes || '-'}</span>
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
                
                {activeExtras.express && (
                  <div className="total-row" style={{ color: '#555', fontSize: '13px', margin: '2px 0' }}><span>Rush Order:</span><span>P100.00</span></div>
                )}
                
                {subExtras.extra_detergent > 0 && (
                  <div className="total-row" style={{ color: '#555', fontSize: '13px', margin: '2px 0' }}><span>Extra Detergent (x{subExtras.extra_detergent}):</span><span>P{(subExtras.extra_detergent * 20).toFixed(2)}</span></div>
                )}

                {subExtras.extra_softener > 0 && (
                  <div className="total-row" style={{ color: '#555', fontSize: '13px', margin: '2px 0' }}><span>Extra Softener (x{subExtras.extra_softener}):</span><span>P{(subExtras.extra_softener * 20).toFixed(2)}</span></div>
                )}

                {subExtras.stain_removal && (
                  <div className="total-row" style={{ color: '#555', fontSize: '13px', margin: '2px 0' }}><span>Stain Removal:</span><span>P50.00</span></div>
                )}

                {activeExtras.discount && discountAmount > 0 && (
                  <div className="total-row" style={{ color: '#e53935', fontSize: '13px', margin: '2px 0' }}><span>Discount:</span><span>-P{Number(discountAmount).toFixed(2)}</span></div>
                )}

                <div className="total-row"><span>Total Payment:</span><strong>P{totalPayment.toFixed(2)}</strong></div>
              </div>
            </div>

            <div className="for-receipt-button">
              <button className="for-receipt-clear" onClick={resetForm}>Clear</button>
              <button onClick={handleCompleteTransaction} className="for-receipt-savebtn" disabled={isSaving}>
                {isSaving ? 'Saving...' : 'Complete and Save'}
              </button>
            </div>
          </section>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default POs;