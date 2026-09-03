-- ============================================================
-- FOOD DELIVERY MANAGEMENT SYSTEM
-- schema.sql  ->  Database + tables + keys + constraints
-- Built from the supplied Chen ER diagram and requirement doc.
-- ============================================================

DROP DATABASE IF EXISTS food_delivery;
CREATE DATABASE food_delivery;
USE food_delivery;

-- ------------------------------------------------------------
-- CUSTOMER
-- Recursive Refers_To relationship -> self FK Referred_By.
-- ------------------------------------------------------------
CREATE TABLE CUSTOMER (
    Customer_ID   INT AUTO_INCREMENT PRIMARY KEY,
    Name          VARCHAR(100) NOT NULL,
    Phone         VARCHAR(20)  NOT NULL,
    Email         VARCHAR(120) UNIQUE,
    Address       VARCHAR(255),
    Referred_By   INT NULL,
    CONSTRAINT fk_customer_referral
        FOREIGN KEY (Referred_By) REFERENCES CUSTOMER(Customer_ID)
        ON DELETE SET NULL
);

-- ------------------------------------------------------------
-- RESTAURANT
-- ------------------------------------------------------------
CREATE TABLE RESTAURANT (
    Restaurant_ID INT AUTO_INCREMENT PRIMARY KEY,
    Name          VARCHAR(100) NOT NULL,
    Address       VARCHAR(255),
    Phone         VARCHAR(20),
    Rating        DECIMAL(2,1) DEFAULT 0.0 CHECK (Rating >= 0 AND Rating <= 5)
);

-- ------------------------------------------------------------
-- DELIVERY_AGENT
-- ------------------------------------------------------------
CREATE TABLE DELIVERY_AGENT (
    Agent_ID    INT AUTO_INCREMENT PRIMARY KEY,
    Agent_Name  VARCHAR(100) NOT NULL,
    Phone       VARCHAR(20),
    Vehicle_No  VARCHAR(30)
);

-- ------------------------------------------------------------
-- MENU_ITEM   (RESTAURANT Offers MENU_ITEM : 1 -> N)
-- ------------------------------------------------------------
CREATE TABLE MENU_ITEM (
    Item_ID       INT AUTO_INCREMENT PRIMARY KEY,
    Restaurant_ID INT NOT NULL,
    Item_Name     VARCHAR(100) NOT NULL,
    Category      VARCHAR(60),
    Price         DECIMAL(8,2) NOT NULL CHECK (Price >= 0),
    Availability  TINYINT(1) NOT NULL DEFAULT 1,
    CONSTRAINT fk_menu_restaurant
        FOREIGN KEY (Restaurant_ID) REFERENCES RESTAURANT(Restaurant_ID)
        ON DELETE CASCADE
);

-- ------------------------------------------------------------
-- ORDER  (reserved word -> table name `ORDERS`)
-- CUSTOMER Places ORDER (1->N), RESTAURANT Processes ORDER (1->N)
-- ------------------------------------------------------------
CREATE TABLE ORDERS (
    Order_ID      INT AUTO_INCREMENT PRIMARY KEY,
    Customer_ID   INT NOT NULL,
    Restaurant_ID INT NOT NULL,
    Order_Date    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    Status        VARCHAR(30) NOT NULL DEFAULT 'Pending',
    Total_Amount  DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    CONSTRAINT fk_order_customer
        FOREIGN KEY (Customer_ID) REFERENCES CUSTOMER(Customer_ID),
    CONSTRAINT fk_order_restaurant
        FOREIGN KEY (Restaurant_ID) REFERENCES RESTAURANT(Restaurant_ID)
);

-- ------------------------------------------------------------
-- ORDER_ITEM  (WEAK ENTITY)
-- Existence depends on ORDER. Partial key Item_No + owner Order_ID.
-- Refers_To MENU_ITEM (N -> 1).
-- ------------------------------------------------------------
CREATE TABLE ORDER_ITEM (
    Order_ID    INT NOT NULL,
    Item_No     INT NOT NULL,
    Item_ID     INT NOT NULL,
    Quantity    INT NOT NULL CHECK (Quantity > 0),
    Unit_Price  DECIMAL(8,2) NOT NULL,
    Subtotal    DECIMAL(10,2) NOT NULL,
    PRIMARY KEY (Order_ID, Item_No),
    CONSTRAINT fk_oi_order
        FOREIGN KEY (Order_ID) REFERENCES ORDERS(Order_ID) ON DELETE CASCADE,
    CONSTRAINT fk_oi_menuitem
        FOREIGN KEY (Item_ID) REFERENCES MENU_ITEM(Item_ID)
);

-- ------------------------------------------------------------
-- PAYMENT   (ORDER Has PAYMENT : 1 -> 1)
-- ------------------------------------------------------------
CREATE TABLE PAYMENT (
    Payment_ID     INT AUTO_INCREMENT PRIMARY KEY,
    Order_ID       INT NOT NULL UNIQUE,
    Amount         DECIMAL(10,2) NOT NULL,
    Payment_Date   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    Payment_Status VARCHAR(30) NOT NULL DEFAULT 'Pending',
    Method         VARCHAR(10) NOT NULL,   -- 'Card' | 'UPI' | 'COD'
    CONSTRAINT fk_payment_order
        FOREIGN KEY (Order_ID) REFERENCES ORDERS(Order_ID) ON DELETE CASCADE,
    CONSTRAINT chk_payment_method CHECK (Method IN ('Card','UPI','COD'))
);

-- ------------------------------------------------------------
-- PAYMENT ISA specialisation -> three subtype tables.
-- Each subtype PK is also FK to PAYMENT (shared primary key).
-- ------------------------------------------------------------
CREATE TABLE CARD_PAYMENT (
    Payment_ID INT PRIMARY KEY,
    Card_Last4 CHAR(4) NOT NULL,
    CONSTRAINT fk_card_payment
        FOREIGN KEY (Payment_ID) REFERENCES PAYMENT(Payment_ID) ON DELETE CASCADE
);

CREATE TABLE UPI_PAYMENT (
    Payment_ID INT PRIMARY KEY,
    UPI_ID     VARCHAR(60) NOT NULL,
    CONSTRAINT fk_upi_payment
        FOREIGN KEY (Payment_ID) REFERENCES PAYMENT(Payment_ID) ON DELETE CASCADE
);

CREATE TABLE COD_PAYMENT (
    Payment_ID  INT PRIMARY KEY,
    Received_By VARCHAR(100),
    CONSTRAINT fk_cod_payment
        FOREIGN KEY (Payment_ID) REFERENCES PAYMENT(Payment_ID) ON DELETE CASCADE
);

-- ------------------------------------------------------------
-- DELIVERY   (ORDER Has DELIVERY : 1 -> 1,
--             DELIVERY Handled_By DELIVERY_AGENT : N -> 1)
-- ------------------------------------------------------------
CREATE TABLE DELIVERY (
    Delivery_ID    INT AUTO_INCREMENT PRIMARY KEY,
    Order_ID       INT NOT NULL UNIQUE,
    Agent_ID       INT NULL,
    Delivery_Time  DATETIME NULL,
    Status         VARCHAR(30) NOT NULL DEFAULT 'Assigned',
    Estimated_Time VARCHAR(30),
    CONSTRAINT fk_delivery_order
        FOREIGN KEY (Order_ID) REFERENCES ORDERS(Order_ID) ON DELETE CASCADE,
    CONSTRAINT fk_delivery_agent
        FOREIGN KEY (Agent_ID) REFERENCES DELIVERY_AGENT(Agent_ID)
        ON DELETE SET NULL
);

-- ------------------------------------------------------------
-- REVIEW  (CUSTOMER Writes REVIEW, REVIEW About ORDER)
-- ------------------------------------------------------------
CREATE TABLE REVIEW (
    Review_No   INT AUTO_INCREMENT PRIMARY KEY,
    Customer_ID INT NOT NULL,
    Order_ID    INT NOT NULL,
    Rating      INT CHECK (Rating >= 1 AND Rating <= 5),
    Comment     VARCHAR(255),
    Review_Date DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_review_customer
        FOREIGN KEY (Customer_ID) REFERENCES CUSTOMER(Customer_ID) ON DELETE CASCADE,
    CONSTRAINT fk_review_order
        FOREIGN KEY (Order_ID) REFERENCES ORDERS(Order_ID) ON DELETE CASCADE
);

-- ------------------------------------------------------------
-- FEEDBACK  (CUSTOMER Submits FEEDBACK, FEEDBACK About RESTAURANT)
-- ------------------------------------------------------------
CREATE TABLE FEEDBACK (
    Feedback_No   INT AUTO_INCREMENT PRIMARY KEY,
    Customer_ID   INT NOT NULL,
    Restaurant_ID INT NOT NULL,
    Description   VARCHAR(255),
    Feedback_Date DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_feedback_customer
        FOREIGN KEY (Customer_ID) REFERENCES CUSTOMER(Customer_ID) ON DELETE CASCADE,
    CONSTRAINT fk_feedback_restaurant
        FOREIGN KEY (Restaurant_ID) REFERENCES RESTAURANT(Restaurant_ID) ON DELETE CASCADE
);
