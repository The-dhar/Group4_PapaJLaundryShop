import React, { useState } from 'react';
import DataTable from 'react-data-table-component';
import { BsEye, BsPencilSquare } from "react-icons/bs";
import DashboardLayout from '../components/dashboardlayout';
import '../styles/receiptstyle.css';

const Receiptmanagement = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('All');
  const [filterLaundry, setFilterLaundry] = useState('All');
  const [selectedReceipt, setSelectedReceipt] = useState(null);
  const [editReceipt, setEditReceipt] = useState(null);
  const [penaltyFee, setPenaltyFee] = useState('');

  const closeModal = () => setSelectedReceipt(null);
  const closeEditModal = () => setEditReceipt(null);

  const handleView = (row) => setSelectedReceipt(row);
  const handleEditStatus = (row) => setEditReceipt(row);

  const handleSavePenalty = () => {
    setTableData((prevData) =>
      prevData.map((item) =>
        item.receipt === editReceipt.receipt
          ? { ...item, penaltyFee: penaltyFee || 0 }
          : item
      )
    );
    setEditReceipt(null);
    setPenaltyFee('');
  };

  const columns = [
    { name: 'Receipt ID', selector: row => row.receipt },
    { name: 'Name', selector: row => row.name },
    { name: 'Item Type', selector: row => row.item },
    { name: 'Laundry Type', selector: row => row.laundryType },
    { name: 'Quantity', selector: row => row.quantity },
    { name: 'Price', selector: row => row.price },
    { name: 'Payment Status', selector: row => row.paymentStatus },
    { name: 'Laundry Status', selector: row => row.laundryStatus },
    { name: 'Penalty', selector: row => row.penaltyFee },
    { name: 'Date', selector: row => row.duedate },
    {
      name: 'Action',
      cell: (row) => (
        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            onClick={() => handleView(row)}
            className="receipt-action-btn view"
          >
            <BsEye />
          </button>
          <button
            onClick={() => handleEditStatus(row)}
            className="receipt-action-btn edit"
          >
            <BsPencilSquare />
          </button>
        </div>
      ),
    },
  ];

  const [tableData, setTableData] = useState([
    {receipt: 'RCPT-01933',name: 'Johnny',item: 'Blanket',laundryType: 'Wash-and-fold',quantity: '1',price: '₱100',paymentStatus: 'Paid',penaltyFee: '₱0',laundryStatus: 'In-shop',duedate: '11/8/2025',},
    {receipt: 'RCPT-01334',name: 'Ana Marie',item: 'Clothes',laundryType: 'Wash-and-fold',price: '₱100',quantity: '1',paymentStatus: 'Unpaid',penaltyFee: '₱0',laundryStatus: 'In-shop',duedate: '11/8/2025',},
    { receipt: 'RCPT-03245', name: 'Ashley', item: 'Pants', laundryType: 'Dry-cleaning', quantity: '1', price: '₱100', paymentStatus: 'Paid', penaltyFee: '₱0', laundryStatus: 'Picked Up', duedate: '11/8/2025' },
    { receipt: 'RCPT-19934', name: 'Kai Curtis', item: 'Curtains', laundryType: 'Wash-and-fold', quantity: '1', price: '₱100', paymentStatus: 'Paid', penaltyFee: '₱0', laundryStatus: 'In-shop', duedate: '11/11/2025' },
    { receipt: 'RCPT-10209', name: 'Skylar', item: 'Comforter', laundryType: 'Wash-and-fold', quantity: '1', price: '₱100', paymentStatus: 'Unpaid', penaltyFee: '₱50', laundryStatus: 'In-shop', duedate: '11/1/2025' },
    { receipt: 'RCPT-13843', name: 'Rowan Ismael', item: 'Blanket', laundryType: 'Dry-cleaning', quantity: '1', price: '₱100', paymentStatus: 'Paid', penaltyFee: '₱0', laundryStatus: 'Picked Up', duedate: '11/8/2025' },
    { receipt: 'RCPT-23343', name: 'Benjamin', item: 'Blanket', laundryType: 'Wash-and-fold', quantity: '1', price: '₱100', paymentStatus: 'Paid', penaltyFee: '₱0', laundryStatus: 'In-shop', duedate: '11/8/2025' },
    { receipt: 'RCPT-34909', name: 'Luna', item: 'Mix-Clothes', laundryType: 'Wash-and-fold', quantity: '1', price: '₱100', paymentStatus: 'Paid', penaltyFee: '₱0', laundryStatus: 'Picked Up', duedate: '11/8/2025' },
    { receipt: 'RCPT-23913', name: 'Johnny', item: 'Blanket', laundryType: 'Dry-cleaning', quantity: '1', price: '₱100', paymentStatus: 'Unpaid', penaltyFee: '₱0', laundryStatus: 'In-shop', duedate: '11/8/2025' },
    { receipt: 'RCP-09001', name: 'Johnny', item: 'Clothes', laundryType: 'Wash-and-fold', quantity: '1', price: '₱100', paymentStatus: 'Paid', penaltyFee: '₱0', laundryStatus: 'In-shop', duedate: '11/8/2025' },
    { receipt: 'RCPT-13462', name: 'Johnny', item: 'Blanket', laundryType: 'Wash-and-fold', quantity: '1', price: '₱100', paymentStatus: 'Paid', penaltyFee: '₱0', laundryStatus: 'In-shop', duedate: '11/8/2025' },
    { receipt: 'RCPT-92039', name: 'Johnny', item: 'Clothes', laundryType: 'Dry-cleaning', quantity: '1', price: '₱100', paymentStatus: 'Paid', penaltyFee: '₱0', laundryStatus: 'In-shop', duedate: '11/8/2025' },
]);
  

  const filteredData = tableData.filter((row) => {
    const matchesStatus =
      filterStatus === 'All' ||
      row.paymentStatus.toLowerCase() === filterStatus.toLowerCase();
    const matchesLaundry =
      filterLaundry === 'All' ||
      row.laundryStatus.toLowerCase() === filterLaundry.toLowerCase();
    const matchesSearch =
      row.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      row.item.toLowerCase().includes(searchTerm.toLowerCase()) ||
      row.receipt.toLowerCase().includes(searchTerm.toLowerCase());

    return matchesStatus && matchesLaundry && matchesSearch;
  });

  return (
    <DashboardLayout>
      <div className="receipt-container">
        <div className="receipt-background">
          {/* === Filters === */}
          <div className="receipt-filter-row">
            <input
              type="text"
              placeholder="Search by receipt number, customer name..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <select
              onChange={(e) => setFilterStatus(e.target.value)}
              value={filterStatus}
            >
              <option value="All">All Payments</option>
              <option value="Paid">Paid</option>
              <option value="Unpaid">Unpaid</option>
            </select>
            <select
              value={filterLaundry}
              onChange={(e) => setFilterLaundry(e.target.value)}
            >
              <option value="All">All Laundry Status</option>
              <option value="In-shop">In-shop</option>
              <option value="Pick-up">Pick-up</option>
            </select>
          </div>

          {/* === Table === */}
          <div className="receipt-table-wrapper">
            <DataTable
              columns={columns}
              data={filteredData}
              highlightOnHover
              fixedHeader
              fixedHeaderScrollHeight="95vh"
            />
          </div>
        </div>
      </div>

      {/* === View Modal === */}
      {selectedReceipt && (
        <div className="receipt-modal">
          <div className="receipt-modal-content">
            <h3>Receipt Details</h3>
            <p><strong>Receipt ID:</strong> {selectedReceipt.receipt}</p>
            <p><strong>Name:</strong> {selectedReceipt.name}</p>
            <p><strong>Item:</strong> {selectedReceipt.item}</p>
            <p><strong>Laundry Type:</strong> {selectedReceipt.laundryType}</p>
            <p><strong>Quantity:</strong> {selectedReceipt.quantity}</p>
            <p><strong>Price:</strong> {selectedReceipt.price}</p>
            <p><strong>Penalty:</strong> {selectedReceipt.penaltyFee}</p>
            <p><strong>Payment Status:</strong> {selectedReceipt.paymentStatus}</p>
            <p><strong>Laundry Status:</strong> {selectedReceipt.laundryStatus}</p>
            <button onClick={closeModal} className="receipt-btn-cancel">
              Close
            </button>
          </div>
        </div>
      )}

      {/* === Edit Modal === */}
      {editReceipt && (
        <div className="receipt-modal">
          <div className="receipt-modal-content">
            <h3>Update Receipt Status</h3>
            <p><strong>Receipt ID:</strong> {editReceipt.receipt}</p>
            <label>Penalty Fee:</label>
            <input
              type="number"
              value={penaltyFee}
              onChange={(e) => setPenaltyFee(e.target.value)}
              placeholder="Enter penalty fee"
            />
            <div className="receipt-modal-buttons">
              <button onClick={handleSavePenalty} className="receipt-btn-save">
                Save
              </button>
              <button onClick={closeEditModal} className="receipt-btn-cancel">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
};

export default Receiptmanagement;
