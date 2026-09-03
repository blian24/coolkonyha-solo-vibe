// Search and Filter Functions

// Data caches for filtering
let allCustomersData = [];
let allSuppliersData = [];
let allProductsData = [];
let allOrdersData = [];
let currentOrderStatusFilter = 'ALL';

// Filter Customers
const filterCustomers = () => {
    const searchText = document.getElementById('searchCustomers').value.toLowerCase();
    const table = document.querySelector('#customersTable table');
    if (!table) return;

    const rows = table.querySelectorAll('tbody > tr');

    rows.forEach((row) => {
        if (!row.classList.contains('details-row')) {
            const text = row.textContent.toLowerCase();
            const shouldShow = text.includes(searchText);
            row.style.display = shouldShow ? '' : 'none';

            // Also hide/show the details row
            const nextRow = row.nextElementSibling;
            if (nextRow && nextRow.classList.contains('details-row')) {
                nextRow.style.display = shouldShow ? '' : 'none';
            }
        }
    });
};

// Filter Suppliers
const filterSuppliers = () => {
    const searchText = document.getElementById('searchSuppliers').value.toLowerCase();
    const table = document.querySelector('#suppliersTable table');
    if (!table) return;

    const rows = table.querySelectorAll('tbody > tr');

    rows.forEach((row) => {
        if (!row.classList.contains('details-row')) {
            const text = row.textContent.toLowerCase();
            const shouldShow = text.includes(searchText);
            row.style.display = shouldShow ? '' : 'none';

            // Also hide/show the details row
            const nextRow = row.nextElementSibling;
            if (nextRow && nextRow.classList.contains('details-row')) {
                nextRow.style.display = shouldShow ? '' : 'none';
            }
        }
    });
};

// Filter Products
const filterProducts = () => {
    const searchText = document.getElementById('searchProducts').value.toLowerCase();
    const table = document.querySelector('#productsTable table');
    if (!table) return;

    const rows = table.querySelectorAll('tbody > tr');

    rows.forEach((row) => {
        if (!row.classList.contains('details-row')) {
            const text = row.textContent.toLowerCase();
            const shouldShow = text.includes(searchText);
            row.style.display = shouldShow ? '' : 'none';

            // Also hide/show the details row
            const nextRow = row.nextElementSibling;
            if (nextRow && nextRow.classList.contains('details-row')) {
                nextRow.style.display = shouldShow ? '' : 'none';
            }
        }
    });
};

// Filter Orders by search text
const filterOrders = () => {
    const searchText = document.getElementById('searchOrders').value.toLowerCase();
    const table = document.querySelector('#ordersTable table');
    if (!table) return;

    const rows = table.querySelectorAll('tbody > tr');

    rows.forEach((row) => {
        if (!row.classList.contains('details-row')) {
            const text = row.textContent.toLowerCase();
            const statusBadge = row.querySelector('.status-badge');
            const rowStatus = statusBadge ? statusBadge.textContent.trim().replace(/\s+/g, '_').toUpperCase() : '';

            const matchesSearch = text.includes(searchText);
            const matchesStatus = currentOrderStatusFilter === 'ALL' || rowStatus === currentOrderStatusFilter;
            const shouldShow = matchesSearch && matchesStatus;

            row.style.display = shouldShow ? '' : 'none';

            // Also hide/show the details row
            const nextRow = row.nextElementSibling;
            if (nextRow && nextRow.classList.contains('details-row')) {
                nextRow.style.display = shouldShow ? '' : 'none';
            }
        }
    });
};

// Filter Orders by status
const filterOrdersByStatus = (status) => {
    currentOrderStatusFilter = status;

    // Update active button
    document.querySelectorAll('.filter-buttons .filter-btn').forEach((btn) => {
        btn.classList.remove('active');
    });
    event.target.classList.add('active');

    // Apply filter
    filterOrders();
};
