const mongoose = require('mongoose');
const SaleSchema = new mongoose.Schema({
    items: [{
        productId: mongoose.Schema.Types.ObjectId,
        name: String,
        qty: Number,
        mode: String,
        soldPrice: Number,
        profit: Number
    }],
    totalAmount: Number,
    totalProfit: Number,
    createdAt: { type: Date, default: Date.now }
});
module.exports = mongoose.model('Sale', SaleSchema);