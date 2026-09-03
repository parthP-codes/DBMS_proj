-- ============================================================
-- FOOD DELIVERY MANAGEMENT SYSTEM
-- seed.sql  ->  Realistic sample data
-- Run AFTER schema.sql.
-- ============================================================
USE food_delivery;

-- Clear existing data (child -> parent order) so re-seeding is safe.
SET FOREIGN_KEY_CHECKS = 0;
TRUNCATE TABLE CARD_PAYMENT;
TRUNCATE TABLE UPI_PAYMENT;
TRUNCATE TABLE COD_PAYMENT;
TRUNCATE TABLE PAYMENT;
TRUNCATE TABLE DELIVERY;
TRUNCATE TABLE REVIEW;
TRUNCATE TABLE FEEDBACK;
TRUNCATE TABLE ORDER_ITEM;
TRUNCATE TABLE ORDERS;
TRUNCATE TABLE MENU_ITEM;
TRUNCATE TABLE DELIVERY_AGENT;
TRUNCATE TABLE RESTAURANT;
TRUNCATE TABLE CUSTOMER;
SET FOREIGN_KEY_CHECKS = 1;

-- ---------------- CUSTOMER ----------------
INSERT INTO CUSTOMER (Customer_ID, Name, Phone, Email, Address) VALUES
(1 ,'Aarav Sharma'  ,'9810012301','aarav.sharma@gmail.com' ,'12 MG Road, Bengaluru'),
(2 ,'Priya Menon'   ,'9810012302','priya.menon@gmail.com'  ,'45 Anna Salai, Chennai'),
(3 ,'Rohan Gupta'   ,'9810012303','rohan.gupta@gmail.com'  ,'7 Park Street, Kolkata'),
(4 ,'Sneha Iyer'    ,'9810012304','sneha.iyer@gmail.com'   ,'23 FC Road, Pune'),
(5 ,'Vikram Nair'   ,'9810012305','vikram.nair@gmail.com'  ,'9 Marine Drive, Mumbai'),
(6 ,'Ananya Rao'    ,'9810012306','ananya.rao@gmail.com'   ,'56 Jubilee Hills, Hyderabad'),
(7 ,'Karthik Reddy' ,'9810012307','karthik.reddy@gmail.com','88 Brigade Road, Bengaluru'),
(8 ,'Meera Joshi'   ,'9810012308','meera.joshi@gmail.com'  ,'14 CG Road, Ahmedabad'),
(9 ,'Arjun Singh'   ,'9810012309','arjun.singh@gmail.com'  ,'31 Connaught Place, Delhi'),
(10,'Divya Pillai'  ,'9810012310','divya.pillai@gmail.com' ,'62 MG Road, Kochi');

-- Referral relationships (Refers_To : CUSTOMER -> CUSTOMER)
UPDATE CUSTOMER SET Referred_By = 1 WHERE Customer_ID = 3;
UPDATE CUSTOMER SET Referred_By = 2 WHERE Customer_ID = 4;
UPDATE CUSTOMER SET Referred_By = 1 WHERE Customer_ID = 6;
UPDATE CUSTOMER SET Referred_By = 5 WHERE Customer_ID = 8;
UPDATE CUSTOMER SET Referred_By = 6 WHERE Customer_ID = 10;

-- ---------------- RESTAURANT ----------------
INSERT INTO RESTAURANT (Restaurant_ID, Name, Address, Phone, Rating) VALUES
(1,'Spice Villa'  ,'21 Church Street, Bengaluru' ,'080-4001001',4.5),
(2,'Pizza Planet' ,'5 Linking Road, Mumbai'      ,'022-4002002',4.2),
(3,'Burger Hub'   ,'17 Camac Street, Kolkata'    ,'033-4003003',4.0),
(4,'Sushi Corner' ,'9 Banjara Hills, Hyderabad'  ,'040-4004004',4.7),
(5,'Green Bowl'   ,'33 JM Road, Pune'            ,'020-4005005',4.3);

-- ---------------- DELIVERY_AGENT ----------------
INSERT INTO DELIVERY_AGENT (Agent_ID, Agent_Name, Phone, Vehicle_No) VALUES
(1,'Suresh Kumar','9900011101','KA01AB1234'),
(2,'Ramesh Yadav','9900011102','MH02CD5678'),
(3,'Anil Verma'  ,'9900011103','WB03EF9012'),
(4,'Deepak Shah' ,'9900011104','TS04GH3456'),
(5,'Manoj Tiwari','9900011105','MH05IJ7890');

-- ---------------- MENU_ITEM ----------------
INSERT INTO MENU_ITEM (Item_ID, Restaurant_ID, Item_Name, Category, Price, Availability) VALUES
(1 ,1,'Paneer Butter Masala','Main Course',220.00,1),
(2 ,1,'Chicken Biryani'     ,'Main Course',250.00,1),
(3 ,1,'Garlic Naan'         ,'Bread'      , 45.00,1),
(4 ,1,'Veg Thali'           ,'Combo'      ,180.00,1),
(5 ,2,'Margherita Pizza'    ,'Pizza'      ,300.00,1),
(6 ,2,'Farmhouse Pizza'     ,'Pizza'      ,420.00,1),
(7 ,2,'Garlic Bread'        ,'Starter'    ,150.00,1),
(8 ,2,'Pepsi'               ,'Beverage'   , 60.00,1),
(9 ,3,'Veg Burger'          ,'Burger'     ,120.00,1),
(10,3,'Chicken Burger'      ,'Burger'     ,160.00,1),
(11,3,'French Fries'        ,'Sides'      , 90.00,1),
(12,3,'Cold Coffee'         ,'Beverage'   ,110.00,1),
(13,4,'California Roll'     ,'Sushi'      ,350.00,1),
(14,4,'Salmon Nigiri'       ,'Sushi'      ,400.00,1),
(15,4,'Miso Soup'           ,'Soup'       ,120.00,1),
(16,5,'Caesar Salad'        ,'Salad'      ,200.00,1),
(17,5,'Quinoa Bowl'         ,'Bowl'       ,260.00,1),
(18,5,'Fresh Juice'         ,'Beverage'   ,130.00,0);

-- ---------------- ORDERS ----------------
INSERT INTO ORDERS (Order_ID, Customer_ID, Restaurant_ID, Order_Date, Status, Total_Amount) VALUES
(1 ,1 ,1,'2026-08-20 12:30:00','Delivered'       ,310.00),
(2 ,2 ,2,'2026-08-21 19:10:00','Delivered'       ,420.00),
(3 ,3 ,3,'2026-08-22 13:45:00','Delivered'       ,410.00),
(4 ,4 ,1,'2026-08-25 20:05:00','Out for Delivery',590.00),
(5 ,5 ,4,'2026-08-26 21:15:00','Preparing'       ,590.00),
(6 ,6 ,5,'2026-08-27 11:00:00','Delivered'       ,520.00),
(7 ,7 ,2,'2026-08-28 20:40:00','Delivered'       ,570.00),
(8 ,8 ,3,'2026-08-29 18:20:00','Pending'         ,470.00),
(9 ,9 ,1,'2026-08-30 13:10:00','Delivered'       ,360.00),
(10,10,4,'2026-09-01 21:00:00','Out for Delivery',800.00),
(11,1 ,5,'2026-09-02 12:00:00','Delivered'       ,330.00),
(12,2 ,3,'2026-09-03 19:30:00','Pending'         ,340.00);

-- ---------------- ORDER_ITEM (weak entity) ----------------
INSERT INTO ORDER_ITEM (Order_ID, Item_No, Item_ID, Quantity, Unit_Price, Subtotal) VALUES
(1 ,1,1 ,1,220.00,220.00),
(1 ,2,3 ,2, 45.00, 90.00),
(2 ,1,5 ,1,300.00,300.00),
(2 ,2,8 ,2, 60.00,120.00),
(3 ,1,10,2,160.00,320.00),
(3 ,2,11,1, 90.00, 90.00),
(4 ,1,2 ,2,250.00,500.00),
(4 ,2,3 ,2, 45.00, 90.00),
(5 ,1,13,1,350.00,350.00),
(5 ,2,15,2,120.00,240.00),
(6 ,1,17,1,260.00,260.00),
(6 ,2,18,2,130.00,260.00),
(7 ,1,6 ,1,420.00,420.00),
(7 ,2,7 ,1,150.00,150.00),
(8 ,1,9 ,3,120.00,360.00),
(8 ,2,12,1,110.00,110.00),
(9 ,1,4 ,2,180.00,360.00),
(10,1,14,2,400.00,800.00),
(11,1,16,1,200.00,200.00),
(11,2,18,1,130.00,130.00),
(12,1,10,1,160.00,160.00),
(12,2,11,2, 90.00,180.00);

-- ---------------- PAYMENT + ISA subtypes ----------------
INSERT INTO PAYMENT (Payment_ID, Order_ID, Amount, Payment_Date, Payment_Status, Method) VALUES
(1 ,1 ,310.00,'2026-08-20 12:31:00','Paid'   ,'Card'),
(2 ,2 ,420.00,'2026-08-21 19:11:00','Paid'   ,'UPI'),
(3 ,3 ,410.00,'2026-08-22 14:30:00','Paid'   ,'COD'),
(4 ,4 ,590.00,'2026-08-25 20:06:00','Paid'   ,'Card'),
(5 ,5 ,590.00,'2026-08-26 21:16:00','Pending','UPI'),
(6 ,6 ,520.00,'2026-08-27 11:01:00','Paid'   ,'Card'),
(7 ,7 ,570.00,'2026-08-28 20:41:00','Paid'   ,'UPI'),
(8 ,8 ,470.00,'2026-08-29 18:21:00','Pending','COD'),
(9 ,9 ,360.00,'2026-08-30 13:11:00','Paid'   ,'Card'),
(10,10,800.00,'2026-09-01 21:01:00','Pending','COD'),
(11,11,330.00,'2026-09-02 12:01:00','Paid'   ,'UPI'),
(12,12,340.00,'2026-09-03 19:31:00','Pending','COD');

INSERT INTO CARD_PAYMENT (Payment_ID, Card_Last4) VALUES
(1,'4321'),(4,'8765'),(6,'1199'),(9,'3344');

INSERT INTO UPI_PAYMENT (Payment_ID, UPI_ID) VALUES
(2,'priya.menon@okhdfc'),(5,'vikram.nair@ybl'),(7,'karthik.reddy@oksbi'),(11,'divya.pillai@okaxis');

INSERT INTO COD_PAYMENT (Payment_ID, Received_By) VALUES
(3,'Anil Verma'),(8,NULL),(10,'Manoj Tiwari'),(12,NULL);

-- ---------------- DELIVERY ----------------
INSERT INTO DELIVERY (Delivery_ID, Order_ID, Agent_ID, Delivery_Time, Status, Estimated_Time) VALUES
(1 ,1 ,1,'2026-08-20 13:05:00','Delivered'       ,'30 mins'),
(2 ,2 ,2,'2026-08-21 19:45:00','Delivered'       ,'35 mins'),
(3 ,3 ,3,'2026-08-22 14:20:00','Delivered'       ,'35 mins'),
(4 ,4 ,1,NULL                 ,'Out for Delivery','40 mins'),
(5 ,5 ,4,NULL                 ,'Assigned'        ,'45 mins'),
(6 ,6 ,2,'2026-08-27 11:40:00','Delivered'       ,'40 mins'),
(7 ,7 ,5,'2026-08-28 21:20:00','Delivered'       ,'40 mins'),
(8 ,8 ,3,NULL                 ,'Assigned'        ,'30 mins'),
(9 ,9 ,4,'2026-08-30 13:45:00','Delivered'       ,'35 mins'),
(10,10,5,NULL                 ,'Out for Delivery','50 mins'),
(11,11,1,'2026-09-02 12:35:00','Delivered'       ,'30 mins'),
(12,12,2,NULL                 ,'Assigned'        ,'35 mins');

-- ---------------- REVIEW (about ORDER) ----------------
INSERT INTO REVIEW (Review_No, Customer_ID, Order_ID, Rating, Comment, Review_Date) VALUES
(1,1,1 ,5,'Great food, delivered hot and fast!'   ,'2026-08-20 14:00:00'),
(2,2,2 ,4,'Pizza was tasty, would order again.'   ,'2026-08-21 20:30:00'),
(3,3,3 ,4,'Juicy burgers, fries a little cold.'   ,'2026-08-22 15:00:00'),
(4,6,6 ,5,'Healthy and fresh, loved the bowl.'    ,'2026-08-27 12:30:00'),
(5,7,7 ,3,'Good pizza but delivery was late.'     ,'2026-08-28 22:00:00'),
(6,9,9 ,5,'Authentic thali, great value.'         ,'2026-08-30 14:30:00'),
(7,1,11,4,'Fresh salad, nice packaging.'          ,'2026-09-02 13:00:00');

-- ---------------- FEEDBACK (about RESTAURANT) ----------------
INSERT INTO FEEDBACK (Feedback_No, Customer_ID, Restaurant_ID, Description, Feedback_Date) VALUES
(1,1,1,'Please add more vegan main course options.' ,'2026-08-21 10:00:00'),
(2,2,2,'Excellent service and quick preparation.'    ,'2026-08-22 09:30:00'),
(3,5,4,'Sushi is great, improve the packaging.'      ,'2026-08-27 18:00:00'),
(4,8,3,'Nice ambience and friendly staff.'           ,'2026-08-30 20:00:00'),
(5,6,5,'Keep up the healthy menu, very happy!'       ,'2026-08-28 11:00:00');
