const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
    prodName: { type: String, required: true, trim: true },
    unitVal: { type: Number, required: true },
    unitType: { type: String, required: true },
    buyFormat: String,
    subQty1: Number,  // Stores Packets/Ctn or Pcs/Pkt
    subQty2: Number,  // Stores Pcs/Pkt (for cartons)
    totalItems: Number,
    buyPrice: Number,
    sellPrice: Number,
    unitCost: Number,
    profit: Number,
    minLimit: { type: Number, default: 0 }
}, { timestamps: true });
productSchema.index({ prodName: 1, unitVal: 1, unitType: 1 }, {unique:true});
module.exports = mongoose.model('Product', productSchema);