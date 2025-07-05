// Global Variables
let cart = [];
let totalPrice = 0;

// Sample Products Data
const products = [
    {
        id: 1,
        name: "אוזניות בלוטות' איכותיות",
        description: "אוזניות אלחוטיות עם איכות צליל מעולה וביטול רעש",
        price: 299,
        originalPrice: 399,
        icon: "fas fa-headphones",
        category: "אלקטרוניקה"
    },
    {
        id: 2,
        name: "שעון חכם מתקדם",
        description: "שעון חכם עם מסך מגע, מעקב בריאות ויכולות חכמות",
        price: 599,
        originalPrice: 799,
        icon: "fas fa-clock",
        category: "אלקטרוניקה"
    },
    {
        id: 3,
        name: "מכונת קפה אספרסו",
        description: "מכונת קפה מקצועית לבית עם מספר תוכניות",
        price: 899,
        originalPrice: 1199,
        icon: "fas fa-coffee",
        category: "מוצרי בית"
    },
    {
        id: 4,
        name: "מקלדת גיימינג מכנית",
        description: "מקלדת מכנית עם תאורה RGB לחוויית גיימינג מושלמת",
        price: 199,
        originalPrice: 299,
        icon: "fas fa-keyboard",
        category: "מחשבים"
    },
    {
        id: 5,
        name: "רמקול בלוטות' נייד",
        description: "רמקול אלחוטי עמיד במים עם באטריה ארוכת טווח",
        price: 149,
        originalPrice: 199,
        icon: "fas fa-volume-up",
        category: "אלקטרוניקה"
    },
    {
        id: 6,
        name: "מסך מחשב 4K",
        description: "מסך מחשב 27 אינץ' ברזולוציית 4K עם טכנולוגיית HDR",
        price: 1299,
        originalPrice: 1699,
        icon: "fas fa-desktop",
        category: "מחשבים"
    },
    {
        id: 7,
        name: "שואב אבק רובוטי",
        description: "שואב אבק רובוטי חכם עם מיפוי והשליטה מהטלפון",
        price: 799,
        originalPrice: 999,
        icon: "fas fa-robot",
        category: "מוצרי בית"
    },
    {
        id: 8,
        name: "טאבלט 10 אינץ'",
        description: "טאבלט מתקדם עם מסך 10 אינץ' וביצועים מהירים",
        price: 699,
        originalPrice: 899,
        icon: "fas fa-tablet-alt",
        category: "אלקטרוניקה"
    }
];

// DOM Elements
const cartBtn = document.querySelector('.cart-btn');
const cartModal = document.getElementById('cart-modal');
const closeCartBtn = document.querySelector('.close-cart');
const cartItemsContainer = document.getElementById('cart-items');
const cartTotalElement = document.getElementById('cart-total');
const cartCountElement = document.querySelector('.cart-count');
const productsGrid = document.getElementById('products-grid');
const newsletterForm = document.querySelector('.newsletter-form');
const checkoutBtn = document.querySelector('.checkout-btn');

// Initialize Website
document.addEventListener('DOMContentLoaded', function() {
    initializeScrollAnimations();
    loadProducts();
    initializeEventListeners();
    initializeSmoothScrolling();
    updateCartDisplay();
    
    // Add loading animation
    document.body.classList.add('fade-in');
    
    // Load cart from localStorage
    loadCartFromStorage();
});

// Initialize Event Listeners
function initializeEventListeners() {
    // Cart Modal
    cartBtn.addEventListener('click', openCartModal);
    closeCartBtn.addEventListener('click', closeCartModal);
    cartModal.addEventListener('click', function(e) {
        if (e.target === cartModal) {
            closeCartModal();
        }
    });
    
    // Newsletter Form
    newsletterForm.addEventListener('submit', handleNewsletterSubmit);
    
    // Checkout Button
    checkoutBtn.addEventListener('click', handleCheckout);
    
    // Mobile Menu Toggle
    const menuToggle = document.querySelector('.menu-toggle');
    const nav = document.querySelector('.nav');
    
    menuToggle.addEventListener('click', function() {
        nav.classList.toggle('active');
    });
    
    // Scroll Event for Header
    window.addEventListener('scroll', handleScroll);
}

// Initialize Smooth Scrolling
function initializeSmoothScrolling() {
    const navLinks = document.querySelectorAll('.nav-link');
    
    navLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            const targetId = this.getAttribute('href').substring(1);
            const targetElement = document.getElementById(targetId);
            
            if (targetElement) {
                const headerHeight = document.querySelector('.header').offsetHeight;
                const targetPosition = targetElement.offsetTop - headerHeight;
                
                window.scrollTo({
                    top: targetPosition,
                    behavior: 'smooth'
                });
            }
        });
    });
}

// Initialize Scroll Animations
function initializeScrollAnimations() {
    const observer = new IntersectionObserver(
        (entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('visible');
                }
            });
        },
        {
            threshold: 0.1,
            rootMargin: '0px 0px -50px 0px'
        }
    );
    
    // Add animation classes to elements
    const elementsToAnimate = document.querySelectorAll('.feature-card, .product-card, .deal-card');
    elementsToAnimate.forEach(element => {
        element.classList.add('scroll-animation');
        observer.observe(element);
    });
}

// Load Products
function loadProducts() {
    productsGrid.innerHTML = '';
    
    products.forEach(product => {
        const productCard = createProductCard(product);
        productsGrid.appendChild(productCard);
    });
}

// Create Product Card
function createProductCard(product) {
    const card = document.createElement('div');
    card.className = 'product-card';
    
    card.innerHTML = `
        <div class="product-image">
            <i class="${product.icon}"></i>
        </div>
        <div class="product-info">
            <h3 class="product-title">${product.name}</h3>
            <p class="product-description">${product.description}</p>
            <div class="product-price">
                <span class="current-price">₪${product.price}</span>
                <span class="original-price">₪${product.originalPrice}</span>
            </div>
            <div class="product-actions">
                <button class="add-to-cart" onclick="addToCart(${product.id})">
                    הוספה לסל
                </button>
            </div>
        </div>
    `;
    
    return card;
}

// Add to Cart Function
function addToCart(productId) {
    const product = products.find(p => p.id === productId);
    if (!product) return;
    
    const existingItem = cart.find(item => item.id === productId);
    
    if (existingItem) {
        existingItem.quantity += 1;
    } else {
        cart.push({
            ...product,
            quantity: 1
        });
    }
    
    updateCartDisplay();
    saveCartToStorage();
    showSuccessMessage('המוצר נוסף לסל בהצלחה!');
    
    // Add animation to cart button
    cartBtn.style.transform = 'scale(1.1)';
    setTimeout(() => {
        cartBtn.style.transform = 'scale(1)';
    }, 200);
}

// Update Cart Display
function updateCartDisplay() {
    updateCartCount();
    updateCartItems();
    updateCartTotal();
}

// Update Cart Count
function updateCartCount() {
    const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
    cartCountElement.textContent = totalItems;
}

// Update Cart Items
function updateCartItems() {
    cartItemsContainer.innerHTML = '';
    
    if (cart.length === 0) {
        cartItemsContainer.innerHTML = '<p class="empty-cart">העגלה שלכם ריקה</p>';
        return;
    }
    
    cart.forEach(item => {
        const cartItem = createCartItem(item);
        cartItemsContainer.appendChild(cartItem);
    });
}

// Create Cart Item
function createCartItem(item) {
    const cartItem = document.createElement('div');
    cartItem.className = 'cart-item';
    
    cartItem.innerHTML = `
        <div class="cart-item-image">
            <i class="${item.icon}"></i>
        </div>
        <div class="cart-item-info">
            <div class="cart-item-title">${item.name}</div>
            <div class="cart-item-price">₪${item.price}</div>
        </div>
        <div class="cart-item-quantity">
            <button class="quantity-btn" onclick="decreaseQuantity(${item.id})">-</button>
            <span>${item.quantity}</span>
            <button class="quantity-btn" onclick="increaseQuantity(${item.id})">+</button>
        </div>
        <button class="remove-item" onclick="removeFromCart(${item.id})">
            הסרה
        </button>
    `;
    
    return cartItem;
}

// Increase Quantity
function increaseQuantity(productId) {
    const item = cart.find(item => item.id === productId);
    if (item) {
        item.quantity += 1;
        updateCartDisplay();
        saveCartToStorage();
    }
}

// Decrease Quantity
function decreaseQuantity(productId) {
    const item = cart.find(item => item.id === productId);
    if (item && item.quantity > 1) {
        item.quantity -= 1;
        updateCartDisplay();
        saveCartToStorage();
    }
}

// Remove from Cart
function removeFromCart(productId) {
    cart = cart.filter(item => item.id !== productId);
    updateCartDisplay();
    saveCartToStorage();
    showSuccessMessage('המוצר הוסר מהסל');
}

// Update Cart Total
function updateCartTotal() {
    totalPrice = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    cartTotalElement.textContent = totalPrice;
}

// Open Cart Modal
function openCartModal() {
    cartModal.classList.add('active');
    document.body.style.overflow = 'hidden';
}

// Close Cart Modal
function closeCartModal() {
    cartModal.classList.remove('active');
    document.body.style.overflow = 'auto';
}

// Handle Newsletter Submit
function handleNewsletterSubmit(e) {
    e.preventDefault();
    const email = e.target.querySelector('input[type="email"]').value;
    
    if (email) {
        showSuccessMessage('תודה! נרשמתם לרשימת התפוצה בהצלחה');
        e.target.reset();
    }
}

// Handle Checkout
function handleCheckout() {
    if (cart.length === 0) {
        showErrorMessage('העגלה שלכם ריקה');
        return;
    }
    
    // Simulate checkout process
    const checkoutBtn = document.querySelector('.checkout-btn');
    const originalText = checkoutBtn.textContent;
    
    checkoutBtn.innerHTML = '<span class="loading"></span> מעבד...';
    checkoutBtn.disabled = true;
    
    setTimeout(() => {
        showSuccessMessage('הזמנתכם בוצעה בהצלחה! תקבלו מייל אישור בקרוב');
        cart = [];
        updateCartDisplay();
        saveCartToStorage();
        closeCartModal();
        
        checkoutBtn.textContent = originalText;
        checkoutBtn.disabled = false;
    }, 2000);
}

// Show Success Message
function showSuccessMessage(message) {
    const messageDiv = document.createElement('div');
    messageDiv.className = 'success-message';
    messageDiv.textContent = message;
    
    document.body.appendChild(messageDiv);
    
    setTimeout(() => {
        messageDiv.remove();
    }, 3000);
}

// Show Error Message
function showErrorMessage(message) {
    const messageDiv = document.createElement('div');
    messageDiv.className = 'error-message';
    messageDiv.textContent = message;
    
    document.body.appendChild(messageDiv);
    
    setTimeout(() => {
        messageDiv.remove();
    }, 3000);
}

// Handle Scroll
function handleScroll() {
    const header = document.querySelector('.header');
    
    if (window.scrollY > 100) {
        header.style.background = 'rgba(255, 255, 255, 0.95)';
        header.style.backdropFilter = 'blur(10px)';
    } else {
        header.style.background = 'var(--white)';
        header.style.backdropFilter = 'none';
    }
}

// Save Cart to localStorage
function saveCartToStorage() {
    localStorage.setItem('salesCart', JSON.stringify(cart));
}

// Load Cart from localStorage
function loadCartFromStorage() {
    const savedCart = localStorage.getItem('salesCart');
    if (savedCart) {
        cart = JSON.parse(savedCart);
        updateCartDisplay();
    }
}

// Deal Card Click Handlers
document.addEventListener('click', function(e) {
    if (e.target.matches('.deal-card .btn')) {
        const dealCard = e.target.closest('.deal-card');
        const dealTitle = dealCard.querySelector('h3').textContent;
        showSuccessMessage(`עוד מעט נוסיף את ${dealTitle} לאתר!`);
    }
});

// Add keyboard navigation
document.addEventListener('keydown', function(e) {
    // Close cart modal with Escape key
    if (e.key === 'Escape' && cartModal.classList.contains('active')) {
        closeCartModal();
    }
    
    // Toggle cart with C key
    if (e.key === 'c' || e.key === 'C') {
        if (cartModal.classList.contains('active')) {
            closeCartModal();
        } else {
            openCartModal();
        }
    }
});

// Add search functionality (basic)
function searchProducts(query) {
    const filteredProducts = products.filter(product => 
        product.name.includes(query) || 
        product.description.includes(query) ||
        product.category.includes(query)
    );
    
    productsGrid.innerHTML = '';
    filteredProducts.forEach(product => {
        const productCard = createProductCard(product);
        productsGrid.appendChild(productCard);
    });
    
    if (filteredProducts.length === 0) {
        productsGrid.innerHTML = '<p class="no-results">לא נמצאו תוצאות חיפוש</p>';
    }
}

// Initialize product filtering
function initializeProductFiltering() {
    const categories = [...new Set(products.map(product => product.category))];
    
    // Create filter buttons
    const filterContainer = document.createElement('div');
    filterContainer.className = 'filter-container';
    filterContainer.style.cssText = `
        display: flex;
        gap: 1rem;
        margin-bottom: 2rem;
        justify-content: center;
        flex-wrap: wrap;
    `;
    
    // Add "All" button
    const allBtn = document.createElement('button');
    allBtn.textContent = 'כל המוצרים';
    allBtn.className = 'filter-btn active';
    allBtn.onclick = () => filterProducts('all');
    filterContainer.appendChild(allBtn);
    
    // Add category buttons
    categories.forEach(category => {
        const btn = document.createElement('button');
        btn.textContent = category;
        btn.className = 'filter-btn';
        btn.onclick = () => filterProducts(category);
        filterContainer.appendChild(btn);
    });
    
    // Insert filter container before products grid
    productsGrid.parentNode.insertBefore(filterContainer, productsGrid);
}

// Filter Products
function filterProducts(category) {
    const filterBtns = document.querySelectorAll('.filter-btn');
    filterBtns.forEach(btn => btn.classList.remove('active'));
    
    event.target.classList.add('active');
    
    const filteredProducts = category === 'all' 
        ? products 
        : products.filter(product => product.category === category);
    
    productsGrid.innerHTML = '';
    filteredProducts.forEach(product => {
        const productCard = createProductCard(product);
        productsGrid.appendChild(productCard);
    });
}

// Initialize filtering when products are loaded
setTimeout(() => {
    initializeProductFiltering();
    
    // Add CSS for filter buttons
    const style = document.createElement('style');
    style.textContent = `
        .filter-btn {
            padding: 0.5rem 1rem;
            border: 2px solid var(--primary-color);
            background: transparent;
            color: var(--primary-color);
            border-radius: var(--border-radius);
            cursor: pointer;
            transition: var(--transition);
            font-weight: 500;
        }
        
        .filter-btn:hover,
        .filter-btn.active {
            background: var(--primary-color);
            color: var(--white);
        }
        
        .no-results {
            text-align: center;
            color: var(--text-light);
            padding: 2rem;
            font-size: 1.2rem;
        }
    `;
    document.head.appendChild(style);
}, 100);

// Add product quick view functionality
function openProductQuickView(productId) {
    const product = products.find(p => p.id === productId);
    if (!product) return;
    
    // Create quick view modal
    const quickViewModal = document.createElement('div');
    quickViewModal.className = 'quick-view-modal';
    quickViewModal.innerHTML = `
        <div class="quick-view-content">
            <button class="close-quick-view">&times;</button>
            <div class="quick-view-product">
                <div class="quick-view-image">
                    <i class="${product.icon}"></i>
                </div>
                <div class="quick-view-info">
                    <h2>${product.name}</h2>
                    <p>${product.description}</p>
                    <div class="quick-view-price">
                        <span class="current-price">₪${product.price}</span>
                        <span class="original-price">₪${product.originalPrice}</span>
                    </div>
                    <button class="add-to-cart" onclick="addToCart(${product.id}); closeQuickView()">
                        הוספה לסל
                    </button>
                </div>
            </div>
        </div>
    `;
    
    document.body.appendChild(quickViewModal);
    
    // Add event listeners
    quickViewModal.querySelector('.close-quick-view').onclick = closeQuickView;
    quickViewModal.onclick = function(e) {
        if (e.target === quickViewModal) {
            closeQuickView();
        }
    };
    
    // Show modal
    setTimeout(() => {
        quickViewModal.classList.add('active');
    }, 10);
}

function closeQuickView() {
    const quickViewModal = document.querySelector('.quick-view-modal');
    if (quickViewModal) {
        quickViewModal.remove();
    }
}

console.log('🛍️ אתר המכירות נטען בהצלחה! 🛍️');
console.log('✨ כל הפונקציות פעילות ומוכנות לשימוש');
console.log('📱 האתר מותאם לכל המכשירים');
console.log('🎯 הקישו C כדי לפתוח/לסגור את עגלת הקניות');