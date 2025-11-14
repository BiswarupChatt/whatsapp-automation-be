const mongoose = require("mongoose")
const Employee = require("./src/models/employee.model");

async function run() {
    await mongoose.connect("mongodb+srv://chatterjeebiswarup61_db_user:WFC6f40eoXprNTqP@cluster0.j6mbvym.mongodb.net/?appName=Cluster0");

    const result = await Employee.updateMany(
        { isDeleted: { $exists: false } },
        { $set: { isDeleted: false } }
    );

    console.log("Updated:", result);
    mongoose.connection.close();
}

run();
