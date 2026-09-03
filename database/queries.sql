-- ============================================================
-- FOOD DELIVERY MANAGEMENT SYSTEM
-- queries.sql  ->  Demonstration DBMS queries
-- Shows: JOIN, LEFT JOIN, GROUP BY, HAVING, ORDER BY,
--        COUNT, SUM, AVG, Subquery, Self JOIN.
-- ============================================================
USE food_delivery;

-- 1. Customers and their orders (JOIN)
SELECT c.Customer_ID, c.Name, o.Order_ID, o.Order_Date, o.Status, o.Total_Amount
FROM CUSTOMER c
JOIN ORDERS o ON c.Customer_ID = o.Customer_ID
ORDER BY c.Customer_ID, o.Order_ID;

-- 2. Restaurants and their menu items (JOIN, ORDER BY)
SELECT r.Name AS Restaurant, m.Item_Name, m.Category, m.Price, m.Availability
FROM RESTAURANT r
JOIN MENU_ITEM m ON r.Restaurant_ID = m.Restaurant_ID
ORDER BY r.Name, m.Item_Name;

-- 3. Full order details: order + items + menu names (multi-table JOIN)
SELECT o.Order_ID, c.Name AS Customer, r.Name AS Restaurant,
       m.Item_Name, oi.Quantity, oi.Unit_Price, oi.Subtotal
FROM ORDERS o
JOIN CUSTOMER c   ON o.Customer_ID   = c.Customer_ID
JOIN RESTAURANT r ON o.Restaurant_ID = r.Restaurant_ID
JOIN ORDER_ITEM oi ON o.Order_ID     = oi.Order_ID
JOIN MENU_ITEM m  ON oi.Item_ID      = m.Item_ID
ORDER BY o.Order_ID, oi.Item_No;

-- 4. Total revenue by restaurant (JOIN, GROUP BY, SUM, ORDER BY)
SELECT r.Name AS Restaurant, COUNT(o.Order_ID) AS Total_Orders,
       SUM(o.Total_Amount) AS Revenue
FROM RESTAURANT r
JOIN ORDERS o ON r.Restaurant_ID = o.Restaurant_ID
GROUP BY r.Restaurant_ID, r.Name
ORDER BY Revenue DESC;

-- 5. Most ordered menu items (JOIN, GROUP BY, SUM, ORDER BY)
SELECT m.Item_Name, SUM(oi.Quantity) AS Units_Ordered
FROM MENU_ITEM m
JOIN ORDER_ITEM oi ON m.Item_ID = oi.Item_ID
GROUP BY m.Item_ID, m.Item_Name
ORDER BY Units_Ordered DESC;

-- 6. Customer order history with order count and total spend
--    (LEFT JOIN keeps customers with zero orders, GROUP BY, COUNT, SUM)
SELECT c.Customer_ID, c.Name,
       COUNT(o.Order_ID) AS Orders_Placed,
       COALESCE(SUM(o.Total_Amount),0) AS Total_Spent
FROM CUSTOMER c
LEFT JOIN ORDERS o ON c.Customer_ID = o.Customer_ID
GROUP BY c.Customer_ID, c.Name
ORDER BY Total_Spent DESC;

-- 7. Orders grouped by status (GROUP BY, COUNT)
SELECT Status, COUNT(*) AS Num_Orders, SUM(Total_Amount) AS Amount
FROM ORDERS
GROUP BY Status
ORDER BY Num_Orders DESC;

-- 8. Delivery agent assignments (LEFT JOIN keeps unassigned agents, COUNT)
SELECT a.Agent_ID, a.Agent_Name, a.Vehicle_No,
       COUNT(d.Delivery_ID) AS Deliveries_Handled
FROM DELIVERY_AGENT a
LEFT JOIN DELIVERY d ON a.Agent_ID = d.Agent_ID
GROUP BY a.Agent_ID, a.Agent_Name, a.Vehicle_No
ORDER BY Deliveries_Handled DESC;

-- 9. Reviews with customer and order information (multi JOIN)
SELECT rv.Review_No, c.Name AS Customer, rv.Order_ID,
       r.Name AS Restaurant, rv.Rating, rv.Comment, rv.Review_Date
FROM REVIEW rv
JOIN CUSTOMER c   ON rv.Customer_ID = c.Customer_ID
JOIN ORDERS o     ON rv.Order_ID    = o.Order_ID
JOIN RESTAURANT r ON o.Restaurant_ID = r.Restaurant_ID
ORDER BY rv.Review_No;

-- 10. Feedback with restaurant information (JOIN)
SELECT f.Feedback_No, c.Name AS Customer, r.Name AS Restaurant,
       f.Description, f.Feedback_Date
FROM FEEDBACK f
JOIN CUSTOMER c   ON f.Customer_ID   = c.Customer_ID
JOIN RESTAURANT r ON f.Restaurant_ID = r.Restaurant_ID
ORDER BY f.Feedback_No;

-- 11. Payment details with method-specific info (LEFT JOIN to each subtype)
SELECT p.Payment_ID, p.Order_ID, p.Amount, p.Method, p.Payment_Status,
       cp.Card_Last4, up.UPI_ID, cod.Received_By
FROM PAYMENT p
LEFT JOIN CARD_PAYMENT cp ON p.Payment_ID = cp.Payment_ID
LEFT JOIN UPI_PAYMENT  up ON p.Payment_ID = up.Payment_ID
LEFT JOIN COD_PAYMENT cod ON p.Payment_ID = cod.Payment_ID
ORDER BY p.Payment_ID;

-- 12. Customer referral relationships (SELF JOIN)
SELECT referred.Customer_ID AS Referred_ID,
       referred.Name        AS Referred_Customer,
       referrer.Name        AS Referred_By
FROM CUSTOMER referred
JOIN CUSTOMER referrer ON referred.Referred_By = referrer.Customer_ID
ORDER BY referrer.Name;

-- ------------------------------------------------------------
-- Extra aggregate demonstrations
-- ------------------------------------------------------------

-- 13. Average rating per restaurant from its reviews (AVG, GROUP BY)
SELECT r.Name AS Restaurant, ROUND(AVG(rv.Rating),2) AS Avg_Review_Rating,
       COUNT(rv.Review_No) AS Num_Reviews
FROM RESTAURANT r
JOIN ORDERS o     ON r.Restaurant_ID = o.Restaurant_ID
JOIN REVIEW rv    ON o.Order_ID      = rv.Order_ID
GROUP BY r.Restaurant_ID, r.Name
ORDER BY Avg_Review_Rating DESC;

-- 14. Restaurants earning more than the average restaurant revenue
--     (Subquery + HAVING)
SELECT r.Name AS Restaurant, SUM(o.Total_Amount) AS Revenue
FROM RESTAURANT r
JOIN ORDERS o ON r.Restaurant_ID = o.Restaurant_ID
GROUP BY r.Restaurant_ID, r.Name
HAVING SUM(o.Total_Amount) > (
    SELECT AVG(rest_total) FROM (
        SELECT SUM(Total_Amount) AS rest_total
        FROM ORDERS GROUP BY Restaurant_ID
    ) AS t
)
ORDER BY Revenue DESC;

-- 15. Customers who spent more than the overall average order value (Subquery)
SELECT c.Name, o.Order_ID, o.Total_Amount
FROM CUSTOMER c
JOIN ORDERS o ON c.Customer_ID = o.Customer_ID
WHERE o.Total_Amount > (SELECT AVG(Total_Amount) FROM ORDERS)
ORDER BY o.Total_Amount DESC;
