const mongoose = require('mongoose');

const MatchSchema = new mongoose.Schema({
    name:{
        type: String,
    },
    email:{
      type: String,
    },
    title:{
        type: String,
    },
    court:{
        type: String,
    },
    datePosted:{
        type: String,
    },
    subscription:{
        type: Boolean,
        default: true
    },
    urlDetailed: {
        String
    },
    createdAt:{
        type: Date,
        default: Date.now
    },
})

module.exports = mongoose.model('Match',MatchSchema)