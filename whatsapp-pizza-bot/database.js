const fs = require('fs').promises;
const path = require('path');

class OrderDatabase {
    constructor() {
        this.ordersFile = path.join(__dirname, 'data', 'orders.json');
        this.customersFile = path.join(__dirname, 'data', 'customers.json');
        this.init();
    }

    async init() {
        // Create data directory if it doesn't exist
        const dataDir = path.join(__dirname, 'data');
        try {
            await fs.mkdir(dataDir, { recursive: true });
            
            // Initialize files if they don't exist
            try {
                await fs.access(this.ordersFile);
            } catch {
                await fs.writeFile(this.ordersFile, '[]');
            }
            
            try {
                await fs.access(this.customersFile);
            } catch {
                await fs.writeFile(this.customersFile, '{}');
            }
        } catch (error) {
            console.error('Error initializing database:', error);
        }
    }

    async saveOrder(order) {
        try {
            // Add timestamp and order ID
            const orderWithMetadata = {
                ...order,
                orderId: this.generateOrderId(),
                timestamp: new Date().toISOString(),
                status: 'pending'
            };

            // Read existing orders
            const ordersData = await fs.readFile(this.ordersFile, 'utf8');
            const orders = JSON.parse(ordersData);
            
            // Add new order
            orders.push(orderWithMetadata);
            
            // Save back to file
            await fs.writeFile(this.ordersFile, JSON.stringify(orders, null, 2));
            
            // Save customer data
            await this.saveCustomer(order.userId, {
                name: order.customerName,
                phone: order.phone,
                address: order.address,
                lastOrder: new Date().toISOString()
            });
            
            return orderWithMetadata;
        } catch (error) {
            console.error('Error saving order:', error);
            throw error;
        }
    }

    async saveCustomer(userId, customerData) {
        try {
            const customersData = await fs.readFile(this.customersFile, 'utf8');
            const customers = JSON.parse(customersData);
            
            // Update or add customer
            customers[userId] = {
                ...customers[userId],
                ...customerData,
                orderCount: (customers[userId]?.orderCount || 0) + 1
            };
            
            await fs.writeFile(this.customersFile, JSON.stringify(customers, null, 2));
        } catch (error) {
            console.error('Error saving customer:', error);
        }
    }

    async getCustomer(userId) {
        try {
            const customersData = await fs.readFile(this.customersFile, 'utf8');
            const customers = JSON.parse(customersData);
            return customers[userId] || null;
        } catch (error) {
            console.error('Error getting customer:', error);
            return null;
        }
    }

    async getOrdersByDate(date) {
        try {
            const ordersData = await fs.readFile(this.ordersFile, 'utf8');
            const orders = JSON.parse(ordersData);
            
            const targetDate = new Date(date).toISOString().split('T')[0];
            return orders.filter(order => 
                order.timestamp.split('T')[0] === targetDate
            );
        } catch (error) {
            console.error('Error getting orders by date:', error);
            return [];
        }
    }

    async getTodayOrders() {
        const today = new Date();
        return this.getOrdersByDate(today);
    }

    async getOrderStats() {
        try {
            const ordersData = await fs.readFile(this.ordersFile, 'utf8');
            const orders = JSON.parse(ordersData);
            
            const today = new Date().toISOString().split('T')[0];
            const todayOrders = orders.filter(order => 
                order.timestamp.split('T')[0] === today
            );
            
            const stats = {
                totalOrders: orders.length,
                todayOrders: todayOrders.length,
                todayRevenue: todayOrders.reduce((sum, order) => sum + order.total, 0),
                averageOrderValue: orders.length > 0 
                    ? orders.reduce((sum, order) => sum + order.total, 0) / orders.length 
                    : 0
            };
            
            return stats;
        } catch (error) {
            console.error('Error getting order stats:', error);
            return {
                totalOrders: 0,
                todayOrders: 0,
                todayRevenue: 0,
                averageOrderValue: 0
            };
        }
    }

    generateOrderId() {
        const date = new Date();
        const year = date.getFullYear().toString().slice(-2);
        const month = (date.getMonth() + 1).toString().padStart(2, '0');
        const day = date.getDate().toString().padStart(2, '0');
        const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
        
        return `ORD${year}${month}${day}${random}`;
    }

    async exportOrdersToCSV() {
        try {
            const ordersData = await fs.readFile(this.ordersFile, 'utf8');
            const orders = JSON.parse(ordersData);
            
            if (orders.length === 0) {
                return 'No orders to export';
            }
            
            // CSV headers
            let csv = 'מספר הזמנה,תאריך,שם לקוח,טלפון,כתובת,פריטים,סה"כ,סטטוס\n';
            
            // Add each order
            orders.forEach(order => {
                const items = order.items.map(item => 
                    `${item.name} ${item.size ? '(' + item.size + ')' : ''}`
                ).join(' | ');
                
                csv += `${order.orderId},`;
                csv += `${new Date(order.timestamp).toLocaleString('he-IL')},`;
                csv += `${order.customerName},`;
                csv += `${order.phone},`;
                csv += `"${order.address}",`;
                csv += `"${items}",`;
                csv += `₪${order.total},`;
                csv += `${order.status}\n`;
            });
            
            const filename = `orders_${new Date().toISOString().split('T')[0]}.csv`;
            await fs.writeFile(path.join(__dirname, 'data', filename), csv);
            
            return filename;
        } catch (error) {
            console.error('Error exporting orders:', error);
            throw error;
        }
    }
}

module.exports = new OrderDatabase();