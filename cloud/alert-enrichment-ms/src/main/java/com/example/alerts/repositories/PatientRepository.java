package com.example.alerts.repositories;

import com.example.alerts.model.Patient;
import io.quarkus.hibernate.orm.panache.PanacheRepository;
import jakarta.enterprise.context.ApplicationScoped;
import java.util.Optional;

@ApplicationScoped
public class PatientRepository implements PanacheRepository<Patient> {

    public Optional<Patient> findByHouseId(Integer houseId) {
        return find("houseId", houseId).firstResultOptional();
    }
}
