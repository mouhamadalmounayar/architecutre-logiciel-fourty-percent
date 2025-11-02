
INSERT INTO doctors (first_name, last_name, email, phone) VALUES
    ('Jim', 'Abi habib', 'jim.abihabib@gmail.com', '0763924496');

INSERT INTO nurses (first_name, last_name, email, phone) VALUES
    ('momo', 'almounayar', 'momo.almounayar@gmail.com', '4934920');

INSERT INTO patients (first_name, last_name, phone, email, date_of_birth, gender, address, current_status, doctor_id, nurse_id, house_id, password_hash) VALUES
    ('John', 'Doe', '555-1001', 'john.doe@email.com', '1975-05-15', 'male', '123 Main St, City', 'active', 1, 1, 1, '$2b$12$BCErGzxFz6vI/.2cDOFVg.i5I8y9y9bC47S0dPaiTAMU1qRH0/zZO'),
    ('Mary', 'Anderson', '555-1003', 'mary.anderson@email.com', '1982-08-22', 'female', '456 Oak Ave, Town', 'active', 1, 1, 2, '$2b$12$BCErGzxFz6vI/.2cDOFVg.i5I8y9y9bC47S0dPaiTAMU1qRH0/zZO'),
    ('Robert', 'Taylor', '555-1005', 'robert.taylor@email.com', '1990-03-10', 'male', '789 Pine Rd, Village', 'active', 1, 1, 3, '$2b$12$BCErGzxFz6vI/.2cDOFVg.i5I8y9y9bC47S0dPaiTAMU1qRH0/zZO'),
    ('Patricia', 'Martinez', '555-1007', 'patricia.martinez@email.com', '1968-11-30', 'female', '321 Elm St, City', 'active', 1, 1, 4, '$2b$12$BCErGzxFz6vI/.2cDOFVg.i5I8y9y9bC47S0dPaiTAMU1qRH0/zZO'),
    ('William', 'Garcia', '555-1009', 'william.garcia@email.com', '2010-07-18', 'male', '654 Maple Dr, Town', 'active', 1, 1, 5, '$2b$12$BCErGzxFz6vI/.2cDOFVg.i5I8y9y9bC47S0dPaiTAMU1qRH0/zZO');

INSERT INTO emergency_contacts (patient_id, first_name, last_name, relationship, phone, email) VALUES
    (1, 'Jane', 'Doe', 'spouse', '555-1002', 'jane.doe@email.com'),
    (1, 'Michael', 'Doe', 'son', '555-1015', 'michael.doe@email.com'),
    (2, 'Tom', 'Anderson', 'husband', '555-1004', 'tom.anderson@email.com'),
    (3, 'Sarah', 'Taylor', 'wife', '555-1006', 'sarah.taylor@email.com'),
    (4, 'Carlos', 'Martinez', 'son', '555-1008', 'carlos.martinez@email.com'),
    (4, 'Isabel', 'Martinez', 'daughter', '555-1016', 'isabel.martinez@email.com'),
    (5, 'Maria', 'Garcia', 'mother', '555-1010', 'maria.garcia@email.com'),
    (5, 'Jose', 'Garcia', 'father', '555-1011', 'jose.garcia@email.com');
