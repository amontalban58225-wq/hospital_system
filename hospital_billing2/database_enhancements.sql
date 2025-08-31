-- Database Enhancements for Hospital Billing System
-- This file contains SQL commands to enhance the database for better billing integration

-- 1. Add price tracking to Billing_Category table
ALTER TABLE `Billing_Category` 
ADD COLUMN `default_price` DECIMAL(10,2) DEFAULT 0.00 AFTER `name`,
ADD COLUMN `is_active` TINYINT(1) DEFAULT 1 AFTER `default_price`;

-- 2. Add reference fields to Billing table for better tracking
ALTER TABLE `Billing` 
ADD COLUMN `reference_id` VARCHAR(50) NULL AFTER `billing_categoryid`,
ADD COLUMN `reference_type` ENUM('room', 'lab_test', 'medicine', 'other') DEFAULT 'other' AFTER `reference_id`,
ADD COLUMN `auto_calculated` TINYINT(1) DEFAULT 0 AFTER `reference_type`;

-- 3. Create a view for comprehensive billing information
CREATE OR REPLACE VIEW `Billing_Details` AS
SELECT 
    b.billingid,
    b.admissionid,
    b.billing_categoryid,
    bc.name as category_name,
    b.description,
    b.quantity,
    b.unit_price,
    b.total_amount,
    b.billing_date,
    b.reference_id,
    b.reference_type,
    b.auto_calculated,
    a.admission_date,
    p.fullname as patient_name,
    d.fullname as doctor_name
FROM Billing b
JOIN Billing_Category bc ON b.billing_categoryid = bc.billing_categoryid
JOIN Admission a ON b.admissionid = a.admissionid
JOIN Patient p ON a.patientid = p.patientid
LEFT JOIN Doctor d ON a.doctorid = d.doctorid
WHERE a.deleted_at IS NULL AND p.deleted_at IS NULL;

-- 4. Create a view for room billing calculations
CREATE OR REPLACE VIEW `Room_Billing_Summary` AS
SELECT 
    ra.admissionid,
    ra.room_no,
    rc.name as room_category,
    rc.rate_per_day,
    ra.start_date,
    ra.end_date,
    CASE 
        WHEN ra.end_date IS NULL THEN DATEDIFF(CURDATE(), ra.start_date) + 1
        ELSE DATEDIFF(ra.end_date, ra.start_date) + 1
    END as days_occupied,
    CASE 
        WHEN ra.end_date IS NULL THEN (DATEDIFF(CURDATE(), ra.start_date) + 1) * rc.rate_per_day
        ELSE (DATEDIFF(ra.end_date, ra.start_date) + 1) * rc.rate_per_day
    END as total_room_cost
FROM Room_Assignment ra
JOIN Room r ON ra.room_no = r.room_no
JOIN Room_Category rc ON r.categoryid = rc.categoryid
WHERE ra.deleted_at IS NULL;

-- 5. Create a view for lab test billing
CREATE OR REPLACE VIEW `Lab_Test_Billing_Summary` AS
SELECT 
    lr.lab_requestid,
    lr.admissionid,
    lr.testid,
    lt.name as test_name,
    lt.price as test_price,
    ltc.name as category_name,
    ltc.handling_fee,
    (lt.price + ltc.handling_fee) as total_cost,
    lr.request_date,
    lr.status
FROM Lab_Request lr
JOIN Lab_Test lt ON lr.testid = lt.testid
JOIN Lab_Test_Category ltc ON lt.categoryid = ltc.labtestcatid
WHERE lr.deleted_at IS NULL AND ltc.is_active = 1;

-- 6. Create a view for medicine billing
CREATE OR REPLACE VIEW `Medicine_Billing_Summary` AS
SELECT 
    pr.prescriptionid,
    pr.admissionid,
    pr.medicineid,
    m.brand_name as medicine_name,
    m.price as unit_price,
    pr.quantity,
    (m.price * pr.quantity) as total_cost,
    pr.prescription_date,
    pr.status
FROM Prescription pr
JOIN Medicine m ON pr.medicineid = m.medicineid
WHERE m.is_deleted = 0;

-- 7. Add indexes for better performance
CREATE INDEX idx_billing_admission ON Billing(admissionid);
CREATE INDEX idx_billing_category ON Billing(billing_categoryid);
CREATE INDEX idx_billing_date ON Billing(billing_date);
CREATE INDEX idx_billing_reference ON Billing(reference_type, reference_id);

CREATE INDEX idx_room_assignment_admission ON Room_Assignment(admissionid);
CREATE INDEX idx_room_assignment_dates ON Room_Assignment(start_date, end_date);

CREATE INDEX idx_lab_request_admission ON Lab_Request(admissionid);
CREATE INDEX idx_lab_request_test ON Lab_Request(testid);

CREATE INDEX idx_prescription_admission ON Prescription(admissionid);
CREATE INDEX idx_prescription_medicine ON Prescription(medicineid);

-- 8. Create a stored procedure for automatic room billing
DELIMITER //
CREATE PROCEDURE `GenerateRoomBilling`(IN admission_id INT)
BEGIN
    DECLARE room_cost DECIMAL(10,2);
    DECLARE days_occupied INT;
    DECLARE room_rate DECIMAL(10,2);
    
    -- Get room assignment details
    SELECT 
        rc.rate_per_day,
        CASE 
            WHEN ra.end_date IS NULL THEN DATEDIFF(CURDATE(), ra.start_date) + 1
            ELSE DATEDIFF(ra.end_date, ra.start_date) + 1
        END
    INTO room_rate, days_occupied
    FROM Room_Assignment ra
    JOIN Room r ON ra.room_no = r.room_no
    JOIN Room_Category rc ON r.categoryid = rc.categoryid
    WHERE ra.admissionid = admission_id AND ra.deleted_at IS NULL
    ORDER BY ra.start_date DESC LIMIT 1;
    
    IF days_occupied > 0 AND room_rate > 0 THEN
        SET room_cost = days_occupied * room_rate;
        
        -- Check if room billing already exists
        IF NOT EXISTS (SELECT 1 FROM Billing WHERE admissionid = admission_id AND reference_type = 'room') THEN
            INSERT INTO Billing (admissionid, billing_categoryid, description, quantity, unit_price, total_amount, reference_id, reference_type, auto_calculated, billing_date)
            VALUES (admission_id, 1, CONCAT('Room accommodation for ', days_occupied, ' days'), days_occupied, room_rate, room_cost, 'AUTO', 'room', 1, NOW());
        END IF;
    END IF;
END //
DELIMITER ;

-- 9. Create a stored procedure for automatic lab test billing
DELIMITER //
CREATE PROCEDURE `GenerateLabTestBilling`(IN admission_id INT)
BEGIN
    DECLARE done INT DEFAULT FALSE;
    DECLARE test_id INT;
    DECLARE test_cost DECIMAL(10,2);
    DECLARE test_name VARCHAR(100);
    
    DECLARE test_cursor CURSOR FOR
        SELECT 
            lr.testid,
            (lt.price + ltc.handling_fee) as total_cost,
            lt.name
        FROM Lab_Request lr
        JOIN Lab_Test lt ON lr.testid = lt.testid
        JOIN Lab_Test_Category ltc ON lt.categoryid = ltc.labtestcatid
        WHERE lr.admissionid = admission_id 
        AND lr.deleted_at IS NULL 
        AND ltc.is_active = 1;
    
    DECLARE CONTINUE HANDLER FOR NOT FOUND SET done = TRUE;
    
    OPEN test_cursor;
    
    read_loop: LOOP
        FETCH test_cursor INTO test_id, test_cost, test_name;
        IF done THEN
            LEAVE read_loop;
        END IF;
        
        -- Check if lab test billing already exists
        IF NOT EXISTS (SELECT 1 FROM Billing WHERE admissionid = admission_id AND reference_type = 'lab_test' AND reference_id = test_id) THEN
            INSERT INTO Billing (admissionid, billing_categoryid, description, quantity, unit_price, total_amount, reference_id, reference_type, auto_calculated, billing_date)
            VALUES (admission_id, 2, CONCAT('Lab Test: ', test_name), 1, test_cost, test_cost, test_id, 'lab_test', 1, NOW());
        END IF;
    END LOOP;
    
    CLOSE test_cursor;
END //
DELIMITER ;

-- 10. Create a stored procedure for automatic medicine billing
DELIMITER //
CREATE PROCEDURE `GenerateMedicineBilling`(IN admission_id INT)
BEGIN
    DECLARE done INT DEFAULT FALSE;
    DECLARE med_id INT;
    DECLARE med_cost DECIMAL(10,2);
    DECLARE med_name VARCHAR(100);
    DECLARE med_quantity INT;
    
    DECLARE med_cursor CURSOR FOR
        SELECT 
            pr.medicineid,
            (m.price * pr.quantity) as total_cost,
            COALESCE(m.brand_name, m.name) as medicine_name,
            pr.quantity
        FROM Prescription pr
        JOIN Medicine m ON pr.medicineid = m.medicineid
        WHERE pr.admissionid = admission_id 
        AND m.is_deleted = 0;
    
    DECLARE CONTINUE HANDLER FOR NOT FOUND SET done = TRUE;
    
    OPEN med_cursor;
    
    read_loop: LOOP
        FETCH med_cursor INTO med_id, med_cost, med_name, med_quantity;
        IF done THEN
            LEAVE read_loop;
        END IF;
        
        -- Check if medicine billing already exists
        IF NOT EXISTS (SELECT 1 FROM Billing WHERE admissionid = admission_id AND reference_type = 'medicine' AND reference_id = med_id) THEN
            INSERT INTO Billing (admissionid, billing_categoryid, description, quantity, unit_price, total_amount, reference_id, reference_type, auto_calculated, billing_date)
            VALUES (admission_id, 3, CONCAT('Medicine: ', med_name), med_quantity, med_cost/med_quantity, med_cost, med_id, 'medicine', 1, NOW());
        END IF;
    END LOOP;
    
    CLOSE med_cursor;
END //
DELIMITER ;

-- 11. Create a trigger to automatically update billing when room assignment changes
DELIMITER //
CREATE TRIGGER `after_room_assignment_update`
AFTER UPDATE ON `Room_Assignment`
FOR EACH ROW
BEGIN
    IF NEW.end_date IS NOT NULL AND OLD.end_date IS NULL THEN
        -- Room assignment ended, generate final billing
        CALL GenerateRoomBilling(NEW.admissionid);
    END IF;
END //
DELIMITER ;

-- 12. Create a trigger to automatically update billing when lab request is completed
DELELIMITER //
CREATE TRIGGER `after_lab_request_update`
AFTER UPDATE ON `Lab_Request`
FOR EACH ROW
BEGIN
    IF NEW.status = 'Completed' AND OLD.status != 'Completed' THEN
        -- Lab test completed, generate billing
        CALL GenerateLabTestBilling(NEW.admissionid);
    END IF;
END //
DELIMITER ;

-- 13. Create a trigger to automatically update billing when prescription is dispensed
DELIMITER //
CREATE TRIGGER `after_prescription_update`
AFTER UPDATE ON `Prescription`
FOR EACH ROW
BEGIN
    IF NEW.status = 'Dispensed' AND OLD.status != 'Dispensed' THEN
        -- Medicine dispensed, generate billing
        CALL GenerateMedicineBilling(NEW.admissionid);
    END IF;
END //
DELIMITER ;

-- 14. Update existing billing categories with default prices
UPDATE `Billing_Category` SET `default_price` = 500.00, `is_active` = 1 WHERE `name` = 'Room';
UPDATE `Billing_Category` SET `default_price` = 150.00, `is_active` = 1 WHERE `name` = 'Laboratory';
UPDATE `Billing_Category` SET `default_price` = 25.00, `is_active` = 1 WHERE `name` = 'Medicine';
UPDATE `Billing_Category` SET `default_price` = 1000.00, `is_active` = 1 WHERE `name` = 'Professional Fee';
UPDATE `Billing_Category` SET `default_price` = 0.00, `is_active` = 1 WHERE `name` = 'Miscellaneous';

-- 15. Create a comprehensive billing summary view
CREATE OR REPLACE VIEW `Comprehensive_Billing_Summary` AS
SELECT 
    a.admissionid,
    p.fullname as patient_name,
    a.admission_date,
    a.status as admission_status,
    COALESCE(SUM(CASE WHEN bc.name = 'Room' THEN b.total_amount ELSE 0 END), 0) as room_total,
    COALESCE(SUM(CASE WHEN bc.name = 'Laboratory' THEN b.total_amount ELSE 0 END), 0) as lab_total,
    COALESCE(SUM(CASE WHEN bc.name = 'Medicine' THEN b.total_amount ELSE 0 END), 0) as medicine_total,
    COALESCE(SUM(CASE WHEN bc.name = 'Professional Fee' THEN b.total_amount ELSE 0 END), 0) as professional_fee_total,
    COALESCE(SUM(CASE WHEN bc.name = 'Miscellaneous' THEN b.total_amount ELSE 0 END), 0) as misc_total,
    COALESCE(SUM(b.total_amount), 0) as grand_total,
    COUNT(b.billingid) as total_billing_items
FROM Admission a
JOIN Patient p ON a.patientid = p.patientid
LEFT JOIN Billing b ON a.admissionid = b.admissionid
LEFT JOIN Billing_Category bc ON b.billing_categoryid = bc.billing_categoryid
WHERE a.deleted_at IS NULL AND p.deleted_at IS NULL
GROUP BY a.admissionid, p.fullname, a.admission_date, a.status;

-- 16. Add comments for documentation
COMMENT ON TABLE Billing IS 'Enhanced billing table with reference tracking for better integration';
COMMENT ON COLUMN Billing.reference_id IS 'ID reference to the specific item (room_no, testid, medicineid, etc.)';
COMMENT ON COLUMN Billing.reference_type IS 'Type of reference: room, lab_test, medicine, or other';
COMMENT ON COLUMN Billing.auto_calculated IS 'Flag indicating if this billing was automatically calculated';

-- 17. Create a function to calculate total billing with discounts
DELIMITER //
CREATE FUNCTION `CalculateBillingWithDiscount`(admission_id INT, discount_percent DECIMAL(5,2))
RETURNS DECIMAL(10,2)
READS SQL DATA
DETERMINISTIC
BEGIN
    DECLARE total_amount DECIMAL(10,2);
    DECLARE discount_amount DECIMAL(10,2);
    
    SELECT COALESCE(SUM(total_amount), 0) INTO total_amount
    FROM Billing
    WHERE admissionid = admission_id;
    
    SET discount_amount = total_amount * (discount_percent / 100);
    
    RETURN total_amount - discount_amount;
END //
DELIMITER ;

-- 18. Create a function to get billing breakdown by category
DELIMITER //
CREATE FUNCTION `GetBillingBreakdown`(admission_id INT, category_name VARCHAR(50))
RETURNS DECIMAL(10,2)
READS SQL DATA
DETERMINISTIC
BEGIN
    DECLARE category_total DECIMAL(10,2);
    
    SELECT COALESCE(SUM(b.total_amount), 0) INTO category_total
    FROM Billing b
    JOIN Billing_Category bc ON b.billing_categoryid = bc.billing_categoryid
    WHERE b.admissionid = admission_id AND bc.name = category_name;
    
    RETURN category_total;
END //
DELIMITER ;

-- End of database enhancements
