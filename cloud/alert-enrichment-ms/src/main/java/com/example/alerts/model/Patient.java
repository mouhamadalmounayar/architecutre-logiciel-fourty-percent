package com.example.alerts.model;

import io.quarkus.hibernate.orm.panache.PanacheEntity;
import jakarta.persistence.*;

@Entity
@Table(name = "patients")
public class Patient extends PanacheEntity {

    @Column(name = "first_name")
    public String firstName;

    @Column(name = "last_name")
    public String lastName;

    @Column(name = "phone")
    public String phone;

    @Column(name = "email")
    public String email;

    @Column(name = "date_of_birth")
    public String dateOfBirth;

    @Column(name = "gender")
    public String gender;

    @Column(name = "address")
    public String address;

    @Column(name = "current_status")
    public String currentStatus;

    @Column(name = "house_id", unique = true)
    public Integer houseId;

    @Column(name = "password_hash")
    public String passwordHash;

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "doctor_id")
    public Doctor doctor;

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "nurse_id")
    public Nurse nurse;
}
