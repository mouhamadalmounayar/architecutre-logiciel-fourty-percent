package com.example.alerts.model;

import io.quarkus.hibernate.orm.panache.PanacheEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;

@Entity
@Table(name = "nurses")
public class Nurse extends PanacheEntity {

    @Column(name = "first_name")
    public String firsName;

    @Column(name = "last_name")
    public String lastName;

    @Column(name = "email")
    public String email;

    @Column(name = "phone")
    public Integer phone;
}
