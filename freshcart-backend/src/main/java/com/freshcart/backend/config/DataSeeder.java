package com.freshcart.backend.config;

import com.freshcart.backend.entity.Product;
import com.freshcart.backend.entity.Role;
import com.freshcart.backend.entity.User;
import com.freshcart.backend.repository.ProductRepository;
import com.freshcart.backend.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.CommandLineRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.util.List;

/**
 * Seeds the database with the same starter catalog the front end used to
 * ship in localStorage, plus a first admin account, so the API is usable
 * immediately after a fresh deploy. Runs once - it no-ops if data already
 * exists (e.g. on every subsequent app restart).
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class DataSeeder implements CommandLineRunner {

    private final ProductRepository productRepository;
    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;

    @Value("${app.admin.email}")
    private String adminEmail;

    @Value("${app.admin.password}")
    private String adminPassword;

    @Override
    public void run(String... args) {
        seedAdmin();
        seedProducts();
    }

    private void seedAdmin() {
        if (userRepository.existsByEmailIgnoreCase(adminEmail)) {
            return;
        }
        User admin = User.builder()
                .name("Admin")
                .email(adminEmail)
                .passwordHash(passwordEncoder.encode(adminPassword))
                .role(Role.ADMIN)
                .build();
        userRepository.save(admin);
        log.info("Seeded default admin account ({})", adminEmail);
    }

    private void seedProducts() {
        if (productRepository.count() > 0) {
            return;
        }
        List<Product> seed = List.of(
                product("Fresh Tomatoes", "Vegetables", "40", "kg", 120, "\uD83C\uDF45"),
                product("Spinach Bunch", "Vegetables", "25", "bunch", 60, "\uD83E\uDD6C"),
                product("Carrots", "Vegetables", "35", "kg", 90, "\uD83E\uDD55"),
                product("Broccoli", "Vegetables", "60", "kg", 40, "\uD83E\uDD66"),
                product("Bell Peppers", "Vegetables", "70", "kg", 55, "\uD83E\uDED1"),
                product("Potatoes", "Vegetables", "28", "kg", 150, "\uD83E\uDD54"),
                product("Fresh Apples", "Fruits", "150", "kg", 80, "\uD83C\uDF4E"),
                product("Bananas", "Fruits", "50", "dozen", 100, "\uD83C\uDF4C"),
                product("Watermelon", "Fruits", "30", "kg", 35, "\uD83C\uDF49"),
                product("Grapes", "Fruits", "90", "kg", 45, "\uD83C\uDF47"),
                product("Mangoes", "Fruits", "110", "kg", 65, "\uD83E\uDD6D"),
                product("Oranges", "Fruits", "65", "kg", 70, "\uD83C\uDF4A")
        );
        productRepository.saveAll(seed);
        log.info("Seeded {} starter products", seed.size());
    }

    private Product product(String name, String category, String price, String unit, int stock, String emoji) {
        return Product.builder()
                .name(name)
                .category(category)
                .price(new BigDecimal(price))
                .unit(unit)
                .stock(stock)
                .emoji(emoji)
                .build();
    }
}
