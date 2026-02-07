const express = require('express');
const router = express.Router();
const Product = require('../models/Product');
const Sale = require('../models/Sale'); // Import the new model
const { ensureAuthenticated, ensureAuthorized } = require('../middleware/auth');
const path = require('path');

// routes/inventory.js

router.get('/', ensureAuthenticated, ensureAuthorized,async (req, res) => {
    try {
        // 1. Get data from Database
        const products = await Product.find().sort({ createdAt: -1 });

        // 2. Render the 'dashboard' file from the 'views' folder
        // We pass the products directly to the HTML
        res.render('dashboard', { 
            products: products,
            totalCount: products.length 
        });
    } catch (err) {
        res.status(500).send("Error loading dashboard");
    }
});


router.get('/add-page',ensureAuthenticated, ensureAuthorized, (req, res) => {
    res.render('addItem');
});
router.post('/add', async (req, res) => {
    try {
        const { prodName, unitVal, unitType } = req.body;

        // MANUAL CHECK: Look for the exact same identity
        const existing = await Product.findOne({ 
            prodName: prodName.trim(), 
            unitVal: unitVal, 
            unitType: unitType 
        });

        if (existing) {
            return res.status(409).json({ 
                message: `The product "${prodName} (${unitVal} ${unitType})" already exists. Please update its stock instead.` 
            });
        }

        // If not found, save new
        const newProduct = new Product(req.body);
        await newProduct.save();
        res.status(201).json({ message: "Success" });

    } catch (err) {
        if (err.code === 11000) {
            return res.status(409).json({ message: "Duplicate product detected by database index." });
        }
        res.status(500).json({ message: "Error: " + err.message });
    }
});

router.get('/update-stock',ensureAuthenticated, ensureAuthorized, async (req, res) => {
    try {
        // Fetch all products to populate the dropdown
        const products = await Product.find().sort({ prodName: 1 });
        res.render('updateStock', { products });
    } catch (err) {
        res.status(500).send("Error loading restock page");
    }
});

router.post('/restock', async (req, res) => {
    try {
        const { productId, addedItems, unitCost, sellPrice, profit } = req.body;

        // Find the product and update its stock and prices
        const product = await Product.findById(productId);
        if (!product) return res.status(404).json({ message: "Product not found" });

        product.totalItems += Number(addedItems); // Add new stock to old stock
        product.unitCost = Number(unitCost);
        product.sellPrice = Number(sellPrice);
        product.profit = Number(profit);

        await product.save();
        res.json({ message: "Success" });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});


// 1. Render the Edit Page
router.get('/edit/:id',ensureAuthenticated, ensureAuthorized, async (req, res) => {
    try {
        const product = await Product.findById(req.params.id);
        res.render('edit-page', { product });
    } catch (err) {
        res.status(500).send("Product not found");
    }
});

// 2. Handle Update Logic
router.put('/update/:id', async (req, res) => {
    try {
        await Product.findByIdAndUpdate(req.params.id, req.body);
        res.status(200).json({ message: "Updated" });
    } catch (err) {
        res.status(500).json({ message: "Update failed" });
    }
});

// 3. Handle Delete
router.delete('/delete/:id', async (req, res) => {
    await Product.findByIdAndDelete(req.params.id);
    res.status(200).send("Deleted");
});

// 3. GET: Fetch all for the table
router.get('/all',ensureAuthenticated, ensureAuthorized, async (req, res) => {
    try {
        const products = await Product.find().sort({ createdAt: -1 });
        res.json(products);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});


// GET: Render the billing page
// Render Billing Page
router.get('/billing',ensureAuthenticated, ensureAuthorized, async (req, res) => {
    const products = await Product.find();
    res.render('billing-page', { products });
});
router.post('/checkout', async (req, res) => {
    const { items } = req.body;
    
    try {
        let totalAmount = 0;
        let totalProfit = 0;
        let saleItems = [];

        for (let item of items) {
            const product = await Product.findById(item.id);
            if (!product) continue;

            const q1 = Number(product.subQty1) || 1;
            const q2 = Number(product.subQty2) || 1;
            const qty = Number(item.qty);
            const mode = item.mode ? item.mode.toLowerCase() : 'unit';

            let deductionAmount = 0; 

            // Logic to determine exactly how many pieces to remove
            if (mode === 'bulk') {
                // If it's a Carton, it's qty * packs * pieces. Otherwise, it's just qty * q1.
                deductionAmount = (product.buyFormat === 'Carton') ? (qty * q1 * q2) : (qty * q1);
            } 
            else if (mode === 'sub') {
                // SMART FIX: If the main format is Packet/Bag, 'sub' refers to that same bulk quantity
                if (product.buyFormat === 'Packet' || product.buyFormat === 'Bag') {
                    deductionAmount = qty * q1;
                } else {
                    deductionAmount = qty * q2;
                }
            } 
            else {
                // Individual pieces
                deductionAmount = qty;
            }

            // Money Calculations
            const lineRevenue = parseFloat(item.price) * qty;
            const actualCost = product.unitCost * deductionAmount;
            const itemProfit = lineRevenue - actualCost;

            totalAmount += lineRevenue;
            totalProfit += itemProfit;

            // Update Database Stock atomically
            await Product.findByIdAndUpdate(item.id, {
                $inc: { totalItems: -deductionAmount }
            });

            saleItems.push({
                productId: product._id,
                name: product.prodName,
                qty: qty,
                mode: item.mode,
                soldPrice: item.price,
                profit: itemProfit
            });
        }

        // Save the Sale for the PNL Page
        const newSale = new Sale({
            items: saleItems,
            totalAmount: totalAmount,
            totalProfit: totalProfit
        });
        await newSale.save();

        res.status(200).json({ message: "Sale processed successfully" });

    } catch (err) {
        console.error("Checkout Error:", err);
        res.status(500).json({ error: "Server error during checkout" });
    }
});
router.get('/pnl', ensureAuthenticated, ensureAuthorized,async (req, res) => {
    try {
        // Get today's start and end
        const start = new Date(); start.setHours(0,0,0,0);
        const end = new Date(); end.setHours(23,59,59,999);

        const sales = await Sale.find({ createdAt: { $gte: start, $lte: end } });
        
        let dailyTotal = 0;
        let dailyProfit = 0;
        sales.forEach(s => {
            dailyTotal += s.totalAmount;
            dailyProfit += s.totalProfit;
        });

        res.render('pnl-page', { sales, dailyTotal, dailyProfit });
    } catch (err) {
        res.status(500).send("Error loading PNL");
    }
});

router.get('/restock-radar', ensureAuthenticated, ensureAuthorized,async (req, res) => {
    try {
        const products = await Product.find();
        const radarItems = products.map(p => {
            let multiplier = 1;
            if (p.buyFormat === 'Carton') multiplier = (p.subQty1 || 1) * (p.subQty2 || 1);
            else if (p.buyFormat === 'Packet' || p.buyFormat === 'Bag') multiplier = (p.subQty1 || 1);
            
            const stockInMainFormat = p.totalItems / multiplier;
            return {
                ...p._doc,
                stockInMainFormat: stockInMainFormat.toFixed(1),
                isLow: stockInMainFormat <= p.minLimit
            };
        });

        // Only show items that are low, or show all but highlight low ones
        res.render('restock-radar', { items: radarItems });
    } catch (err) {
        res.status(500).send("Error loading Radar");
    }
});
module.exports = router;