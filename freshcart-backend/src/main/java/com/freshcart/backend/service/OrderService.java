package com.freshcart.backend.service;

import com.freshcart.backend.dto.*;
import com.freshcart.backend.entity.Order;
import com.freshcart.backend.entity.OrderItem;
import com.freshcart.backend.entity.OrderStatus;
import com.freshcart.backend.entity.Product;
import com.freshcart.backend.entity.User;
import com.freshcart.backend.exception.BadRequestException;
import com.freshcart.backend.exception.ResourceNotFoundException;
import com.freshcart.backend.repository.OrderRepository;
import com.freshcart.backend.repository.ProductRepository;
import com.freshcart.backend.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.List;

@Service
@RequiredArgsConstructor
public class OrderService {

    private static final BigDecimal FREE_DELIVERY_THRESHOLD = new BigDecimal("300");
    private static final BigDecimal DELIVERY_FEE = new BigDecimal("40");

    private final OrderRepository orderRepository;
    private final ProductRepository productRepository;
    private final UserRepository userRepository;

    @Transactional
    public OrderResponse checkout(String userEmail, OrderRequest request) {
        User user = userRepository.findByEmailIgnoreCase(userEmail)
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));

        Order order = Order.builder().user(user).status(OrderStatus.PLACED).build();

        BigDecimal subtotal = BigDecimal.ZERO;

        for (OrderItemRequest itemReq : request.getItems()) {
            Product product = productRepository.findById(itemReq.getProductId())
                    .orElseThrow(() -> new ResourceNotFoundException(
                            "Product not found with id " + itemReq.getProductId()));

            if (product.getStock() < itemReq.getQuantity()) {
                throw new BadRequestException(
                        "Insufficient stock for " + product.getName() + " (available: " + product.getStock() + ")");
            }

            product.setStock(product.getStock() - itemReq.getQuantity());
            productRepository.save(product);

            BigDecimal lineTotal = product.getPrice().multiply(BigDecimal.valueOf(itemReq.getQuantity()));
            subtotal = subtotal.add(lineTotal);

            OrderItem orderItem = OrderItem.builder()
                    .product(product)
                    .productName(product.getName())
                    .price(product.getPrice())
                    .quantity(itemReq.getQuantity())
                    .subtotal(lineTotal)
                    .build();
            order.addItem(orderItem);
        }

        BigDecimal deliveryFee = subtotal.compareTo(BigDecimal.ZERO) > 0
                && subtotal.compareTo(FREE_DELIVERY_THRESHOLD) < 0 ? DELIVERY_FEE : BigDecimal.ZERO;

        order.setSubtotal(subtotal);
        order.setDeliveryFee(deliveryFee);
        order.setTotal(subtotal.add(deliveryFee));

        Order saved = orderRepository.save(order);
        return toResponse(saved);
    }

    @Transactional(readOnly = true)
    public List<OrderResponse> findMyOrders(String userEmail) {
        User user = userRepository.findByEmailIgnoreCase(userEmail)
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));
        return orderRepository.findByUserOrderByCreatedAtDesc(user).stream().map(this::toResponse).toList();
    }

    @Transactional(readOnly = true)
    public List<OrderResponse> findAll() {
        return orderRepository.findAllByOrderByCreatedAtDesc().stream().map(this::toResponse).toList();
    }

    private OrderResponse toResponse(Order order) {
        List<OrderItemResponse> items = order.getItems().stream()
                .map(i -> OrderItemResponse.builder()
                        .productId(i.getProduct().getId())
                        .productName(i.getProductName())
                        .price(i.getPrice())
                        .quantity(i.getQuantity())
                        .subtotal(i.getSubtotal())
                        .build())
                .toList();

        return OrderResponse.builder()
                .id(order.getId())
                .status(order.getStatus().name())
                .subtotal(order.getSubtotal())
                .deliveryFee(order.getDeliveryFee())
                .total(order.getTotal())
                .createdAt(order.getCreatedAt())
                .items(items)
                .build();
    }
}
