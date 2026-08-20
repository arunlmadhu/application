package com.freshcart.backend.controller;

import com.freshcart.backend.dto.AdminStatsResponse;
import com.freshcart.backend.repository.OrderRepository;
import com.freshcart.backend.repository.ProductRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.math.BigDecimal;

/**
 * Backs the Admin Dashboard summary cards (total products, low-stock count,
 * total stock value) shown in the front end's AdminDashboard component.
 */
@RestController
@RequestMapping("/api/admin")
@RequiredArgsConstructor
public class AdminController {

    private static final int LOW_STOCK_THRESHOLD = 20;

    private final ProductRepository productRepository;
    private final OrderRepository orderRepository;

    @GetMapping("/stats")
    public AdminStatsResponse stats() {
        var products = productRepository.findAll();

        long lowStock = products.stream().filter(p -> p.getStock() <= LOW_STOCK_THRESHOLD).count();
        BigDecimal totalStockValue = products.stream()
                .map(p -> p.getPrice().multiply(BigDecimal.valueOf(p.getStock())))
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        return AdminStatsResponse.builder()
                .totalProducts(products.size())
                .lowStockCount(lowStock)
                .totalStockValue(totalStockValue)
                .totalOrders(orderRepository.count())
                .build();
    }
}
