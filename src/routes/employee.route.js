const express = require("express");
const router = express.Router();
const employeeController = require("../controllers/employee.controller");

router.post("/", employeeController.createEmployee);
router.get("/", employeeController.getAllEmployees);
router.get("/:id", employeeController.getEmployeeById);
router.put("/:id", employeeController.updateEmployee);
router.delete("/:id", employeeController.deleteEmployee);
router.post("/upcoming-birthdays", employeeController.getUpcomingBirthdays);


module.exports = router;
