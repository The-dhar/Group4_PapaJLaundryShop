<?php

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\BranchController;
use App\Http\Controllers\Api\TransactionController;
use App\Http\Controllers\Api\CustomerController;
use App\Http\Controllers\Api\ServicePriceController;
use App\Http\Controllers\Api\EmployeeController;

/*
|--------------------------------------------------------------------------
| API Routes
|--------------------------------------------------------------------------
*/

Route::post('/login', [AuthController::class, 'login'])->middleware('throttle:login');

Route::middleware('auth:sanctum')->group(function () {

    Route::post('/logout', [AuthController::class, 'logout']);

    Route::get('/user', function (Request $request) {
        return $request->user();
    });

    Route::get('/branches', [BranchController::class, 'index']);
    Route::post('/branches', [BranchController::class, 'store']);
    Route::put('/branches/{id}/deactivate', [BranchController::class, 'deactivate']);
    Route::put('/branches/{id}/clerk', [BranchController::class, 'updateClerk']);
    Route::put('/branches/{id}', [BranchController::class, 'update']);
    Route::post('/transactions', [TransactionController::class, 'store']);

    Route::post('/customers', [CustomerController::class, 'store']);
    Route::get('/customers/search/{name}', [CustomerController::class, 'search']);

    Route::get('/transactions', [TransactionController::class, 'index']);

    Route::put('/transactions/{id}/mark-paid', [TransactionController::class, 'markPaid']);
    Route::put('/transactions/{id}/update-payment', [TransactionController::class, 'updatePayment']);
    Route::put('/transactions/{id}', [TransactionController::class, 'update']);
    Route::put('/transactions/{id}/archive', [TransactionController::class, 'archive']);
    Route::put('/transactions/{id}/restore', [TransactionController::class, 'restore']);

    Route::get('/service-prices', [ServicePriceController::class, 'index']);
    Route::post('/service-prices', [ServicePriceController::class, 'store']);
    Route::put('/service-prices/{id}', [ServicePriceController::class, 'update']);

    Route::get('/employees', [EmployeeController::class, 'index']);
    Route::post('/employees', [EmployeeController::class, 'store']);
    Route::put('/employees/{id}', [EmployeeController::class, 'update']);
    Route::put('/employees/{id}/assign-branch', [EmployeeController::class, 'assignBranch']);

});
