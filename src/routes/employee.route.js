const express = require("express");
const router = express.Router();
const employeeController = require("../controllers/employee.controller");

router.post("/upcoming-birthdays", employeeController.getUpcomingBirthdays);
router.get("/", employeeController.getAllEmployees);
router.post("/", employeeController.createEmployee);
router.put("/:id", employeeController.updateEmployee);
router.delete("/:id", employeeController.deleteEmployee);
router.get("/:id", employeeController.getEmployeeById);
router.post("/create-many", employeeController.createManyEmployees)

module.exports = router;
