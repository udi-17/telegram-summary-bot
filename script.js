// Global Variables
let currentSection = 'dashboard';
let orders = [];
let products = [];
let customers = [];

// DOM Elements
const navItems = document.querySelectorAll('.nav-item');
const contentSections = document.querySelectorAll('.content-section');

// Initialize the application
document.addEventListener('DOMContentLoaded', function() {
    initializeApp();
    setupEventListeners();
    loadDashboardData();
});

// Initialize the application
function initializeApp() {
    console.log('🍕 בוט הפיצריה מתחיל לפעול...');
    
    // Set active section
    setActiveSection('dashboard');
    
    // Load initial data
    loadProducts();
    loadOrders();
    loadCustomers();
}

// Setup event listeners
function setupEventListeners() {
    // Navigation
    navItems.forEach(item => {
        item.addEventListener('click', function(e) {
            e.preventDefault();
            const section = this.getAttribute('data-section');
            setActiveSection(section);
        });
    });

    // Order filter
    const orderFilter = document.getElementById('order-filter');
    if (orderFilter) {
        orderFilter.addEventListener('change', function() {
            filterOrders(this.value);
        });
    }

    // Add product form
    const addProductForm = document.getElementById('add-product-form');
    if (addProductForm) {
        addProductForm.addEventListener('submit', function(e) {
            e.preventDefault();
            addProduct();
        });
    }

    // Settings form
    const settingsForm = document.querySelector('.settings-container');
    if (settingsForm) {
        const saveButton = settingsForm.querySelector('button[onclick="saveSettings()"]');
        if (saveButton) {
            saveButton.addEventListener('click', saveSettings);
        }
    }
}

// Set active section
function setActiveSection(section) {
    // Remove active class from all sections and nav items
    contentSections.forEach(s => s.classList.remove('active'));
    navItems.forEach(item => item.classList.remove('active'));

    // Add active class to current section and nav item
    const targetSection = document.getElementById(section);
    const targetNavItem = document.querySelector(`[data-section="${section}"]`);

    if (targetSection) {
        targetSection.classList.add('active');
    }

    if (targetNavItem) {
        targetNavItem.classList.add('active');
    }

    currentSection = section;

    // Load section specific data
    switch (section) {
        case 'dashboard':
            loadDashboardData();
            break;
        case 'orders':
            loadOrders();
            break;
        case 'products':
            loadProducts();
            break;
        case 'customers':
            loadCustomers();
            break;
        case 'analytics':
            loadAnalytics();
            break;
        case 'settings':
            loadSettings();
            break;
    }
}

// Load dashboard data
async function loadDashboardData() {
    try {
        // Load stats
        await loadStats();
        
        // Load recent orders
        await loadRecentOrders();
        
    } catch (error) {
        console.error('שגיאה בטעינת נתוני הדשבורד:', error);
        showMessage('שגיאה בטעינת נתוני הדשבורד', 'error');
    }
}

// Load statistics
async function loadStats() {
    try {
        const response = await fetch('/api/orders');
        const orders = await response.json();
        
        const today = new Date().toDateString();
        const todayOrders = orders.filter(order => 
            new Date(order.created_at).toDateString() === today
        );
        
        const totalRevenue = todayOrders.reduce((sum, order) => sum + order.total_price, 0);
        const uniqueCustomers = new Set(todayOrders.map(order => order.customer_phone)).size;
        
        // Update stats
        document.getElementById('total-orders').textContent = todayOrders.length;
        document.getElementById('total-revenue').textContent = `₪${totalRevenue.toFixed(2)}`;
        document.getElementById('total-customers').textContent = uniqueCustomers;
        document.getElementById('avg-delivery').textContent = '30 דק\'';
        
    } catch (error) {
        console.error('שגיאה בטעינת סטטיסטיקות:', error);
    }
}

// Load recent orders
async function loadRecentOrders() {
    try {
        const response = await fetch('/api/orders');
        const orders = await response.json();
        
        const recentOrders = orders.slice(0, 5);
        const container = document.getElementById('recent-orders-list');
        
        if (recentOrders.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-shopping-cart"></i>
                    <h3>אין הזמנות עדיין</h3>
                    <p>ההזמנות הראשונות יופיעו כאן</p>
                </div>
            `;
            return;
        }
        
        container.innerHTML = recentOrders.map(order => createOrderCard(order)).join('');
        
    } catch (error) {
        console.error('שגיאה בטעינת הזמנות אחרונות:', error);
    }
}

// Load orders
async function loadOrders() {
    try {
        const response = await fetch('/api/orders');
        orders = await response.json();
        
        const container = document.getElementById('orders-list');
        
        if (orders.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-shopping-cart"></i>
                    <h3>אין הזמנות</h3>
                    <p>ההזמנות הראשונות יופיעו כאן</p>
                </div>
            `;
            return;
        }
        
        container.innerHTML = orders.map(order => createOrderCard(order)).join('');
        
        // Add click listeners to order cards
        container.querySelectorAll('.order-card').forEach(card => {
            card.addEventListener('click', function() {
                const orderId = this.getAttribute('data-order-id');
                showOrderDetails(orderId);
            });
        });
        
    } catch (error) {
        console.error('שגיאה בטעינת הזמנות:', error);
        showMessage('שגיאה בטעינת ההזמנות', 'error');
    }
}

// Filter orders
function filterOrders(status) {
    const container = document.getElementById('orders-list');
    let filteredOrders = orders;
    
    if (status !== 'all') {
        filteredOrders = orders.filter(order => order.status === status);
    }
    
    if (filteredOrders.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-filter"></i>
                <h3>אין הזמנות בסטטוס זה</h3>
                <p>נסה לבחור סטטוס אחר</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = filteredOrders.map(order => createOrderCard(order)).join('');
    
    // Add click listeners
    container.querySelectorAll('.order-card').forEach(card => {
        card.addEventListener('click', function() {
            const orderId = this.getAttribute('data-order-id');
            showOrderDetails(orderId);
        });
    });
}

// Create order card
function createOrderCard(order) {
    const items = JSON.parse(order.items || '[]');
    const totalItems = items.reduce((sum, item) => sum + item.quantity, 0);
    const date = new Date(order.created_at).toLocaleDateString('he-IL');
    const time = new Date(order.created_at).toLocaleTimeString('he-IL', { 
        hour: '2-digit', 
        minute: '2-digit' 
    });
    
    return `
        <div class="order-card" data-order-id="${order.id}">
            <div class="order-header">
                <span class="order-id">#${order.id}</span>
                <span class="order-status ${order.status}">${getStatusText(order.status)}</span>
            </div>
            <div class="order-details">
                <div class="order-detail">
                    <label>טלפון</label>
                    <span>${order.customer_phone}</span>
                </div>
                <div class="order-detail">
                    <label>סכום</label>
                    <span>₪${order.total_price.toFixed(2)}</span>
                </div>
                <div class="order-detail">
                    <label>פריטים</label>
                    <span>${totalItems}</span>
                </div>
                <div class="order-detail">
                    <label>תאריך</label>
                    <span>${date} ${time}</span>
                </div>
            </div>
            <div class="order-actions">
                <button class="btn btn-primary" onclick="updateOrderStatus(${order.id}, 'preparing')">
                    <i class="fas fa-utensils"></i>
                    בהכנה
                </button>
                <button class="btn btn-success" onclick="updateOrderStatus(${order.id}, 'delivering')">
                    <i class="fas fa-truck"></i>
                    במשלוח
                </button>
                <button class="btn btn-warning" onclick="updateOrderStatus(${order.id}, 'completed')">
                    <i class="fas fa-check"></i>
                    הושלם
                </button>
            </div>
        </div>
    `;
}

// Get status text
function getStatusText(status) {
    const statusMap = {
        'pending': 'ממתין',
        'preparing': 'בהכנה',
        'delivering': 'במשלוח',
        'completed': 'הושלם'
    };
    return statusMap[status] || status;
}

// Update order status
async function updateOrderStatus(orderId, status) {
    try {
        const response = await fetch(`/api/orders/${orderId}/status`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ status })
        });
        
        if (response.ok) {
            showMessage('סטטוס ההזמנה עודכן בהצלחה', 'success');
            loadOrders(); // Reload orders
        } else {
            throw new Error('שגיאה בעדכון הסטטוס');
        }
    } catch (error) {
        console.error('שגיאה בעדכון סטטוס הזמנה:', error);
        showMessage('שגיאה בעדכון סטטוס ההזמנה', 'error');
    }
}

// Show order details
async function showOrderDetails(orderId) {
    try {
        const order = orders.find(o => o.id == orderId);
        if (!order) {
            showMessage('הזמנה לא נמצאה', 'error');
            return;
        }
        
        const items = JSON.parse(order.items || '[]');
        const modal = document.getElementById('order-details-modal');
        const content = document.getElementById('order-details-content');
        
        content.innerHTML = `
            <div class="order-details-full">
                <div class="detail-row">
                    <label>מספר הזמנה:</label>
                    <span>#${order.id}</span>
                </div>
                <div class="detail-row">
                    <label>טלפון:</label>
                    <span>${order.customer_phone}</span>
                </div>
                <div class="detail-row">
                    <label>כתובת:</label>
                    <span>${order.delivery_address || 'לא צוין'}</span>
                </div>
                <div class="detail-row">
                    <label>סטטוס:</label>
                    <span class="order-status ${order.status}">${getStatusText(order.status)}</span>
                </div>
                <div class="detail-row">
                    <label>תאריך:</label>
                    <span>${new Date(order.created_at).toLocaleString('he-IL')}</span>
                </div>
                <div class="detail-row">
                    <label>הערות:</label>
                    <span>${order.notes || 'אין הערות'}</span>
                </div>
                
                <h4>פריטים:</h4>
                <div class="items-list">
                    ${items.map(item => `
                        <div class="item-row">
                            <span>${item.name}</span>
                            <span>x${item.quantity}</span>
                            <span>₪${(item.price * item.quantity).toFixed(2)}</span>
                        </div>
                    `).join('')}
                </div>
                
                <div class="order-total">
                    <strong>סה"כ: ₪${order.total_price.toFixed(2)}</strong>
                </div>
            </div>
        `;
        
        showModal('order-details-modal');
        
    } catch (error) {
        console.error('שגיאה בטעינת פרטי הזמנה:', error);
        showMessage('שגיאה בטעינת פרטי ההזמנה', 'error');
    }
}

// Load products
async function loadProducts() {
    try {
        const response = await fetch('/api/products');
        products = await response.json();
        
        const container = document.getElementById('products-grid');
        
        if (products.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-utensils"></i>
                    <h3>אין מוצרים</h3>
                    <p>הוסף מוצרים חדשים כדי להתחיל</p>
                </div>
            `;
            return;
        }
        
        container.innerHTML = products.map(product => createProductCard(product)).join('');
        
    } catch (error) {
        console.error('שגיאה בטעינת מוצרים:', error);
        showMessage('שגיאה בטעינת המוצרים', 'error');
    }
}

// Create product card
function createProductCard(product) {
    const categoryIcon = getCategoryIcon(product.category);
    
    return `
        <div class="product-card">
            <div class="product-image">
                <i class="${categoryIcon}"></i>
            </div>
            <div class="product-content">
                <h3 class="product-name">${product.name}</h3>
                <p class="product-description">${product.description || 'אין תיאור'}</p>
                <div class="product-price">₪${product.price}</div>
                <div class="product-actions">
                    <button class="btn btn-primary" onclick="editProduct(${product.id})">
                        <i class="fas fa-edit"></i>
                        ערוך
                    </button>
                    <button class="btn btn-danger" onclick="deleteProduct(${product.id})">
                        <i class="fas fa-trash"></i>
                        מחק
                    </button>
                </div>
            </div>
        </div>
    `;
}

// Get category icon
function getCategoryIcon(category) {
    const icons = {
        'pizza': 'fas fa-pizza-slice',
        'drinks': 'fas fa-wine-glass',
        'sides': 'fas fa-utensils'
    };
    return icons[category] || 'fas fa-utensils';
}

// Load customers
async function loadCustomers() {
    try {
        // For now, we'll create sample customers from orders
        const response = await fetch('/api/orders');
        const orders = await response.json();
        
        // Extract unique customers
        const customerMap = new Map();
        orders.forEach(order => {
            if (!customerMap.has(order.customer_phone)) {
                customerMap.set(order.customer_phone, {
                    phone: order.customer_phone,
                    name: order.customer_name || 'לקוח אנונימי',
                    orders: 0,
                    totalSpent: 0
                });
            }
            const customer = customerMap.get(order.customer_phone);
            customer.orders++;
            customer.totalSpent += order.total_price;
        });
        
        customers = Array.from(customerMap.values());
        
        const container = document.getElementById('customers-list');
        
        if (customers.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-users"></i>
                    <h3>אין לקוחות</h3>
                    <p>הלקוחות הראשונים יופיעו כאן</p>
                </div>
            `;
            return;
        }
        
        container.innerHTML = customers.map(customer => createCustomerCard(customer)).join('');
        
    } catch (error) {
        console.error('שגיאה בטעינת לקוחות:', error);
        showMessage('שגיאה בטעינת הלקוחות', 'error');
    }
}

// Create customer card
function createCustomerCard(customer) {
    return `
        <div class="customer-card">
            <div class="customer-info">
                <h4>${customer.name}</h4>
                <p>${customer.phone}</p>
            </div>
            <div class="customer-stats">
                <span>${customer.orders} הזמנות</span>
                <span>₪${customer.totalSpent.toFixed(2)}</span>
            </div>
        </div>
    `;
}

// Load analytics
async function loadAnalytics() {
    try {
        // This would typically load chart data
        // For now, we'll show a placeholder
        const chartContainers = document.querySelectorAll('.chart-container');
        
        chartContainers.forEach(container => {
            const canvas = container.querySelector('canvas');
            if (canvas) {
                // Here you would initialize charts
                // For now, we'll show a placeholder
                canvas.style.background = '#f8f9fa';
                canvas.style.display = 'flex';
                canvas.style.alignItems = 'center';
                canvas.style.justifyContent = 'center';
                canvas.style.height = '200px';
                canvas.style.color = '#6c757d';
                canvas.textContent = 'גרף יוצג כאן';
            }
        });
        
    } catch (error) {
        console.error('שגיאה בטעינת ניתוחים:', error);
        showMessage('שגיאה בטעינת הניתוחים', 'error');
    }
}

// Load settings
function loadSettings() {
    // Settings are loaded from the HTML defaults
    // In a real app, you'd load them from the server
    console.log('הגדרות נטענו');
}

// Show add product modal
function showAddProductModal() {
    showModal('add-product-modal');
}

// Add product
async function addProduct() {
    const form = document.getElementById('add-product-form');
    const formData = new FormData(form);
    
    const product = {
        name: document.getElementById('product-name').value,
        description: document.getElementById('product-description').value,
        price: parseFloat(document.getElementById('product-price').value),
        category: document.getElementById('product-category').value,
        image_url: document.getElementById('product-image').value
    };
    
    try {
        // In a real app, you'd send this to the server
        console.log('מוצר חדש:', product);
        
        showMessage('המוצר נוסף בהצלחה', 'success');
        closeModal('add-product-modal');
        form.reset();
        loadProducts(); // Reload products
        
    } catch (error) {
        console.error('שגיאה בהוספת מוצר:', error);
        showMessage('שגיאה בהוספת המוצר', 'error');
    }
}

// Save settings
async function saveSettings() {
    const settings = {
        restaurantName: document.getElementById('restaurant-name').value,
        restaurantPhone: document.getElementById('restaurant-phone').value,
        restaurantAddress: document.getElementById('restaurant-address').value,
        deliveryTime: document.getElementById('delivery-time').value,
        deliveryCost: document.getElementById('delivery-cost').value,
        welcomeMessage: document.getElementById('welcome-message').value,
        orderCompleteMessage: document.getElementById('order-complete-message').value
    };
    
    try {
        // In a real app, you'd save this to the server
        console.log('הגדרות נשמרו:', settings);
        
        showMessage('ההגדרות נשמרו בהצלחה', 'success');
        
    } catch (error) {
        console.error('שגיאה בשמירת הגדרות:', error);
        showMessage('שגיאה בשמירת ההגדרות', 'error');
    }
}

// Refresh orders
function refreshOrders() {
    loadOrders();
    showMessage('ההזמנות רועננו', 'success');
}

// Show modal
function showModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.add('active');
    }
}

// Close modal
function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.remove('active');
    }
}

// Show message
function showMessage(message, type = 'success') {
    // Create message element
    const messageEl = document.createElement('div');
    messageEl.className = `message ${type}`;
    messageEl.innerHTML = `
        <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : 'info-circle'}"></i>
        <span>${message}</span>
    `;
    
    // Add to page
    document.body.appendChild(messageEl);
    
    // Remove after 3 seconds
    setTimeout(() => {
        messageEl.remove();
    }, 3000);
}

// Edit product (placeholder)
function editProduct(productId) {
    showMessage('פונקציית עריכת מוצר תתווסף בקרוב', 'warning');
}

// Delete product (placeholder)
function deleteProduct(productId) {
    if (confirm('האם אתה בטוח שברצונך למחוק מוצר זה?')) {
        showMessage('פונקציית מחיקת מוצר תתווסף בקרוב', 'warning');
    }
}

// Utility functions
function formatCurrency(amount) {
    return `₪${parseFloat(amount).toFixed(2)}`;
}

function formatDate(dateString) {
    return new Date(dateString).toLocaleDateString('he-IL');
}

function formatTime(dateString) {
    return new Date(dateString).toLocaleTimeString('he-IL', { 
        hour: '2-digit', 
        minute: '2-digit' 
    });
}

// Export functions for global access
window.showAddProductModal = showAddProductModal;
window.closeModal = closeModal;
window.refreshOrders = refreshOrders;
window.updateOrderStatus = updateOrderStatus;
window.saveSettings = saveSettings;
window.editProduct = editProduct;
window.deleteProduct = deleteProduct;