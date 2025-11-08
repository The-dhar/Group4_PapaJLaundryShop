import React, { useState, useEffect } from 'react';
import DataTable from 'react-data-table-component';
import DashboardLayout from '../components/dashboardlayout';
import '../styles/inventorystyle.css'; // scoped to inventory-page

const Inventorymanagement = () => {
  const [filterStatus, setFilterStatus] = useState('All');
  const [searchTerm, setSearchTerm] = useState('');
  const [tableData, setTableData] = useState([
    { receipt: 'RCPT-01933', name: 'Johnny', item: 'Blanket', quantity: '1', price: '₱100', status: 'In-shop', duedate: '11/8/2025' },
    { receipt: 'RCPT-01334', name: 'Ana Marie', item: 'Clothes', quantity: '1', price: '₱100', status: 'In-shop', duedate: '11/8/2025' },
    { receipt: 'RCPT-03245', name: 'Ashley', item: 'Pants', quantity: '1', price: '₱100', status: 'Picked Up', duedate: '11/8/2025' },
    { receipt: 'RCPT-19934', name: 'Kai Curtis', item: 'Curtains', quantity: '1', price: '₱100', status: 'In-shop', duedate: '11/11/2025' },
    { receipt: 'RCPT-10209', name: 'Skylar', item: 'Comforter', quantity: '1', price: '₱100', status: 'In-shop', duedate: '11/1/2025' },
    { receipt: 'RCPT-13843', name: 'Rowan Ismael', item: 'Blanket', quantity: '1', price: '₱100', status: 'Picked Up', duedate: '11/8/2025' },
    { receipt: 'RCPT-23343', name: 'Benjamin', item: 'Blanket', quantity: '1', price: '₱100', status: 'In-shop', duedate: '11/8/2025' },
    { receipt: 'RCPT-34909', name: 'Luna', item: 'Mix-Clothes', quantity: '1', price: '₱100', status: 'Picked Up', duedate: '11/8/2025' },
    { receipt: 'RCPT-23913', name: 'Johnny', item: 'Blanket', quantity: '1', price: '₱100', status: 'In-shop', duedate: '11/8/2025' },
    { receipt: 'RCP-09001', name: 'Johnny', item: 'Clothes', quantity: '1', price: '₱100', status: 'In-shop', duedate: '11/8/2025' },
    { receipt: 'RCPT-13462', name: 'Johnny', item: 'Blanket', quantity: '1', price: '₱100', status: 'In-shop', duedate: '11/8/2025' },
    { receipt: 'RCPT-92039', name: 'Johnny', item: 'Clothes', quantity: '1', price: '₱100', status: 'In-shop', duedate: '11/8/2025' },
  ]);

  const handleStatusChange = (receipt, newStatus) => {
    const updatedData = tableData.map((row) =>
      row.receipt === receipt ? { ...row, status: newStatus } : row
    );
    setTableData(updatedData);
  };

  const isOverdue = (dateStr) => {
    if (!dateStr) return false;
    let dueDate = null;

    if (dateStr.includes('/')) {
      const parts = dateStr.split('/');
      if (parts.length === 3) {
        const [month, day, year] = parts.map(Number);
        dueDate = new Date(year, month - 1, day);
      }
    }

    if (!dueDate || isNaN(dueDate.getTime())) {
      const parsed = new Date(dateStr);
      if (!isNaN(parsed.getTime())) dueDate = parsed;
    }

    if (!dueDate || isNaN(dueDate.getTime())) return false;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    dueDate.setHours(0, 0, 0, 0);

    return dueDate < today;
  };

  useEffect(() => {
    const overdueItems = tableData.filter(
      (row) => isOverdue(row.duedate) && row.status !== 'Picked Up'
    );

    if (overdueItems.length > 0) {
      const receipts = overdueItems.map((item) => item.receipt).join(', ');
      alert(`The following receipts are overdue: ${receipts}`);
    }
  }, [tableData]);

  const filteredData = tableData.filter((row) => {
    const matchesStatus =
      filterStatus === 'All' ||
      row.status.toLowerCase() === filterStatus.toLowerCase();
    const matchesSearch =
      row.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      row.item.toLowerCase().includes(searchTerm.toLowerCase()) ||
      row.receipt.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  const columns = [
    { name: 'Receipt ID', selector: (row) => row.receipt },
    { name: 'Name', selector: (row) => row.name },
    { name: 'Item Type', selector: (row) => row.item },
    { name: 'Quantity', selector: (row) => row.quantity },
    { name: 'Price', selector: (row) => row.price },
    { name: 'Status', selector: (row) => row.status },
    { name: 'Due Date', selector: (row) => row.duedate },
    {
      name: 'Action',
      cell: (row) => (
        <select
          value={row.status}
          onChange={(e) => handleStatusChange(row.receipt, e.target.value)}
          style={{ padding: '5px', borderRadius: '5px' }}
        >
          <option value="In-shop">In-shop</option>
          <option value="Picked Up">Picked Up</option>
        </select>
      ),
    },
  ];

  const conditionalRowStyles = [
    {
      when: (row) => isOverdue(row.duedate) && row.status !== 'Picked Up',
      style: {
        backgroundColor: '#fac0c0ff',
        color: '#721c24',
        fontWeight: 'bold',
      },
    },
  ];

  return (
    <DashboardLayout>
      {/* SCOPED PAGE WRAPPER HERE */}
      <div className="inventory-page">
        <div className="table-container">
          <div className="background-table">
            {/* Search and Filter */}
            <div className="search-filter-row">
              <input
                type="text"
                placeholder="Search by receipt, customer name, or item..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              <select
                onChange={(e) => setFilterStatus(e.target.value)}
                value={filterStatus}
              >
                <option value="All">All</option>
                <option value="In-shop">In-shop</option>
                <option value="Picked Up">Picked Up</option>
              </select>
            </div>

            {/* Data Table */}
            <div className="table-wrapper">
              <DataTable
                columns={columns}
                data={filteredData}
                conditionalRowStyles={conditionalRowStyles}
                fixedHeader
                fixedHeaderScrollHeight="70vh"
              />
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default Inventorymanagement;
