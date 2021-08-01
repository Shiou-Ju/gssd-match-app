const mongoose = require('mongoose');

const PostSchema = new mongoose.Schema({
    court: {  
    type: String,
    },
    addressee:{
        type: String,
    },
    title:{
        type: String,
    },
    type:{
        type: String,
    },
    urlDetailed:{
      type: String,
    },
    datePosted:{
        type: String,
    },
    createdAt:{
        type: Date,
        default: Date.now
    },
    innerContent:{
      type: String,
    },
})

module.exports = mongoose.model('listings',PostSchema)