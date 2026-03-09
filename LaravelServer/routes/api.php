<?php

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\BranchController;
use App\Http\Controllers\Api\TransactionController;
use App\Http\Controllers\Api\CustomerController;

/*
|--------------------------------------------------------------------------
| API Routes
|--------------------------------------------------------------------------
*/

Route::post('/login', [AuthController::class, 'login']);

Route::middleware('auth:sanctum')->group(function () {

    Route::post('/logout', [AuthController::class, 'logout']);

    Route::get('/user', function (Request $request) {
        return $request->user();
    });

    Route::get('/branches', [BranchController::class, 'index']);
    Route::post('/branches', [BranchController::class, 'store']);
    Route::put('/branches/{id}/clerk', [BranchController::class, 'updateClerk']);
    Route::post('/transactions', [TransactionController::class, 'store']);

    Route::post('/customers', [CustomerController::class, 'store']);

    Route::middleware('auth:sanctum')->get('/transactions', [TransactionController::class, 'index']);

    Route::put('/transactions/{id}/mark-paid', [TransactionController::class, 'markPaid']);
    Route::put('/transactions/{id}/update-payment', [TransactionController::class, 'updatePayment']);
    Route::put('/transactions/{id}/archive', [TransactionController::class, 'archive']);
    
});

Route::get('/customers/search/{name}', [CustomerController::class, 'search']);
