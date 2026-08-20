package com.freshcart.backend.controller;

import com.freshcart.backend.dto.OrderRequest;
import com.freshcart.backend.dto.OrderResponse;
import com.freshcart.backend.service.OrderService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/orders")
@RequiredArgsConstructor
public class OrderController {

    private final OrderService orderService;

    // Checkout - creates an order from the cart, decrements stock. Requires login.
    @PostMapping
    public ResponseEntity<OrderResponse> checkout(@AuthenticationPrincipal UserDetails principal,
                                                    @Valid @RequestBody OrderRequest request) {
        OrderResponse order = orderService.checkout(principal.getUsername(), request);
        return ResponseEntity.status(HttpStatus.CREATED).body(order);
    }

    // The logged-in customer's own order history.
    @GetMapping("/my")
    public List<OrderResponse> myOrders(@AuthenticationPrincipal UserDetails principal) {
        return orderService.findMyOrders(principal.getUsername());
    }

    // Admin only (enforced in SecurityConfig) - every order in the system.
    @GetMapping
    public List<OrderResponse> allOrders() {
        return orderService.findAll();
    }
}
