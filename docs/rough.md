# PDD.md — Shop Management Software

## Product Name

**StoreFlow**

## One-Line Description

StoreFlow is a simple shop management system that helps small business owners manage staff, products, sales, expenses, customers, suppliers, and shop profiles from one clean dashboard.

## Main Problem

Small shop owners often manage their business using notebooks, WhatsApp messages, spreadsheets, and memory. This makes it difficult to know:

* What products are selling
* What products are low in stock
* How much money came in today
* How much was spent
* Which customers owe money
* Which suppliers need to be paid
* What each staff member is doing
* Whether the shop is making profit or losing money

## Main Users

### Shop Owner

Has full access to the system.

Can manage:

* Products
* Staff
* Sales
* Expenses
* Customers
* Suppliers
* Reports
* Shop settings

### Manager

Can manage daily operations but has limited financial and admin access.

### Cashier / Staff

Can record sales, search products, generate receipts, and view assigned tasks.

## MVP Features

1. Authentication
2. Shop profile setup
3. Staff management
4. Product and inventory management
5. Sales recording
6. Expense tracking
7. Customer debt tracking
8. Supplier management
9. Dashboard
10. Basic reports
11. Role-based permissions

## Recommended Backend

Use:

```txt
FastAPI
PostgreSQL
SQLAlchemy or SQLModel
Alembic
JWT authentication
Cloudflare R2 or Cloudinary
```

FastAPI is the better choice for this product because the system needs business logic, inventory updates, financial reports, permissions, file uploads, and future AI features.

## Core Modules

### Product Management

Allows the shop owner to add, edit, delete, and track products.

Fields include:

* Product name
* Category
* Buying price
* Selling price
* Stock quantity
* Low-stock threshold
* Supplier
* Expiry date
* Product image

### Sales Management

Allows staff to create sales and generate receipts.

The system should automatically:

* Calculate totals
* Reduce stock after sales
* Track payment method
* Record cashier activity
* Support credit sales

### Expense Management

Tracks business expenses such as:

* Rent
* Electricity
* Internet
* Staff salary
* Supplier payment
* Transport
* Maintenance
* Packaging
* Miscellaneous

### Staff Management

Allows the owner to:

* Add staff
* Assign roles
* Set permissions
* Track attendance
* View staff sales activity
* Suspend accounts

### Customer Management

Useful for shops that sell on credit.

Features:

* Customer profile
* Purchase history
* Debt tracking
* Payment history

### Supplier Management

Tracks suppliers, supplied products, and payments.

### Dashboard

Shows:

* Today’s sales
* Today’s expenses
* Estimated profit
* Low-stock products
* Out-of-stock products
* Customer debt
* Staff on duty
* Best-selling products

## Final Product Summary

StoreFlow is a SaaS platform for small shop owners who want a simple way to manage daily business operations. The MVP should focus on the daily workflow of a shop:

* Add products
* Sell products
* Track stock
* Record expenses
* Manage staff
* Track customer debt
* View profit/loss
