CREATE TABLE IF NOT EXISTS doctors (
    id SERIAL PRIMARY KEY,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    phone VARCHAR(20)
);

CREATE TABLE IF NOT EXISTS nurses (
    id SERIAL PRIMARY KEY,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    phone VARCHAR(20)
);

CREATE TABLE IF NOT EXISTS patients (
    id SERIAL PRIMARY KEY,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    phone VARCHAR(20),
    email VARCHAR(100),
    date_of_birth DATE NOT NULL,
    gender VARCHAR(20),
    address VARCHAR(20),
    current_status VARCHAR(50) DEFAULT 'active',
    doctor_id INTEGER REFERENCES doctors(id) ON DELETE SET NULL,
    nurse_id INTEGER REFERENCES nurses(id) ON DELETE SET NULL,
    house_id INTEGER,
    password_hash VARCHAR(255)
);

CREATE TABLE IF NOT EXISTS emergency_contacts (
    id SERIAL PRIMARY KEY,
    patient_id INTEGER REFERENCES patients(id) ON DELETE CASCADE,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    relationship VARCHAR(50),
    phone VARCHAR(20) NOT NULL,
    email VARCHAR(100),
    address VARCHAR(20)
);


CREATE INDEX idx_patients_doctor_id ON patients(doctor_id);
CREATE INDEX idx_patients_nurse_id ON patients(nurse_id);
CREATE INDEX idx_patients_status ON patients(current_status);
CREATE INDEX idx_emergency_contacts_patient_id ON emergency_contacts(patient_id);
