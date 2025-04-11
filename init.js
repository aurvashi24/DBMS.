const mongoose=require('mongoose')
const chat=require('./model/chat')

const main=async()=>{
  await mongoose.connect('mongodb://127.0.0.1:27017/myapp')
}
main().then(()=>{
console.log("connected sucessfully")
})

const messages = [
     
    {
        from: 'ethan',
        to: 'ava',
        msg: 'did you finish the project?',
        created_at: new Date().toString()
    },
    {
        from: 'ryan',
        to: 'sophia',
        msg: 'call me when you’re free.',
        created_at: new Date().toString()
    },
    {
        from: 'daniel',
        to: 'hannah',
        msg: 'movie night tomorrow?',
        created_at: new Date().toString()
    },
    {
        from: 'noah',
        to: 'charlotte',
        msg: 'miss you!',
        created_at: new Date().toString()
    }
];

const chatfunction=async()=>{
    await chat.deleteMany({});
    let init= messages.map((data)=>({...data,owner:"67e6f812daa1945647669e85"}));//
    await chat.insertMany(init)
  console.log("init sucess!!")

}
chatfunction()




