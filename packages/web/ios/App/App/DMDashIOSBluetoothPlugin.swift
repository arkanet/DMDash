import Capacitor
import CoreBluetooth
import Foundation
import UIKit

@objc(DMDashIOSBluetoothPlugin)
public class DMDashIOSBluetoothPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "DMDashIOSBluetoothPlugin"
    public let jsName = "DMDashIOSBluetooth"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "isAvailable", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "requestDevice", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "connect", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "disconnect", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "write", returnType: CAPPluginReturnPromise),
    ]

    private let serviceUuid = CBUUID(string: "6ba1b218-15a8-461f-9fa8-5dcae273eafd")
    private let toRadioUuid = CBUUID(string: "f75c76d2-129e-4dad-a1dd-7866124401e7")
    private let fromRadioUuid = CBUUID(string: "2c55e69e-4993-11ed-b878-0242ac120002")
    private let fromNumUuid = CBUUID(string: "ed9da18c-a800-4f66-a670-aa7547e34453")

    private var central: CBCentralManager?
    private var peripheralsById: [String: CBPeripheral] = [:]
    private var connectedDeviceId: String?
    private var toRadioCharacteristic: CBCharacteristic?
    private var fromRadioCharacteristic: CBCharacteristic?
    private var fromNumCharacteristic: CBCharacteristic?
    private var pendingRequestDeviceCall: CAPPluginCall?
    private var pendingConnectCall: CAPPluginCall?
    private var pendingWriteCalls: [CAPPluginCall] = []

    public override func load() {
        central = CBCentralManager(delegate: self, queue: DispatchQueue.main)
    }

    @objc func isAvailable(_ call: CAPPluginCall) {
        ensureCentral()
        call.resolve(["value": central?.state == .poweredOn])
    }

    @objc func requestDevice(_ call: CAPPluginCall) {
        ensureCentral()
        guard central?.state == .poweredOn else {
            call.reject("Bluetooth is not powered on")
            return
        }

        pendingRequestDeviceCall = call
        peripheralsById.removeAll()
        central?.scanForPeripherals(withServices: [serviceUuid], options: [
            CBCentralManagerScanOptionAllowDuplicatesKey: false,
        ])

        DispatchQueue.main.asyncAfter(deadline: .now() + 4.0) { [weak self] in
            self?.presentDevicePicker()
        }
    }

    @objc func connect(_ call: CAPPluginCall) {
        ensureCentral()
        guard let deviceId = call.getString("deviceId") else {
            call.reject("Missing deviceId")
            return
        }

        guard let peripheral = resolvePeripheral(deviceId: deviceId) else {
            call.reject("Bluetooth device is not available. Select it again.")
            return
        }

        pendingConnectCall = call
        connectedDeviceId = deviceId
        toRadioCharacteristic = nil
        fromRadioCharacteristic = nil
        fromNumCharacteristic = nil
        notifyStatus(deviceId: deviceId, status: "connecting")
        central?.connect(peripheral)
    }

    @objc func disconnect(_ call: CAPPluginCall) {
        guard let deviceId = call.getString("deviceId") else {
            call.reject("Missing deviceId")
            return
        }
        if let peripheral = peripheralsById[deviceId] {
            central?.cancelPeripheralConnection(peripheral)
        }
        notifyStatus(deviceId: deviceId, status: "disconnected", reason: "user")
        call.resolve()
    }

    @objc func write(_ call: CAPPluginCall) {
        guard let deviceId = call.getString("deviceId") else {
            call.reject("Missing deviceId")
            return
        }
        guard deviceId == connectedDeviceId else {
            call.reject("Device is not connected")
            return
        }
        guard let base64Data = call.getString("base64Data"),
              let data = Data(base64Encoded: base64Data),
              let peripheral = peripheralsById[deviceId],
              let toRadioCharacteristic
        else {
            call.reject("Write characteristic is not ready")
            return
        }

        pendingWriteCalls.append(call)
        peripheral.writeValue(data, for: toRadioCharacteristic, type: .withResponse)
    }

    private func ensureCentral() {
        if central == nil {
            central = CBCentralManager(delegate: self, queue: DispatchQueue.main)
        }
    }

    private func resolvePeripheral(deviceId: String) -> CBPeripheral? {
        if let peripheral = peripheralsById[deviceId] {
            return peripheral
        }
        guard let uuid = UUID(uuidString: deviceId),
              let peripheral = central?.retrievePeripherals(withIdentifiers: [uuid]).first
        else {
            return nil
        }
        peripheralsById[deviceId] = peripheral
        return peripheral
    }

    private func presentDevicePicker() {
        central?.stopScan()
        guard let call = pendingRequestDeviceCall else {
            return
        }
        pendingRequestDeviceCall = nil

        let peripherals = Array(peripheralsById.values)
        guard !peripherals.isEmpty else {
            call.reject("No Meshtastic Bluetooth devices found")
            return
        }

        if peripherals.count == 1, let peripheral = peripherals.first {
            resolveDevice(call: call, peripheral: peripheral)
            return
        }

        let alert = UIAlertController(
            title: "Select Meshtastic Device",
            message: nil,
            preferredStyle: .actionSheet
        )
        for peripheral in peripherals {
            alert.addAction(
                UIAlertAction(title: peripheral.name ?? peripheral.identifier.uuidString, style: .default) { [weak self] _ in
                    self?.resolveDevice(call: call, peripheral: peripheral)
                }
            )
        }
        alert.addAction(UIAlertAction(title: "Cancel", style: .cancel) { _ in
            call.reject("Device selection cancelled")
        })

        bridge?.viewController?.present(alert, animated: true)
    }

    private func resolveDevice(call: CAPPluginCall, peripheral: CBPeripheral) {
        let deviceId = peripheral.identifier.uuidString
        peripheralsById[deviceId] = peripheral
        var data: [String: Any] = ["id": deviceId]
        if let name = peripheral.name {
            data["name"] = name
        }
        call.resolve(data)
    }

    private func notifyStatus(deviceId: String, status: String, reason: String? = nil) {
        var data: [String: Any] = [
            "deviceId": deviceId,
            "status": status,
        ]
        if let reason {
            data["reason"] = reason
        }
        notifyListeners("status", data: data)
    }
}

extension DMDashIOSBluetoothPlugin: CBCentralManagerDelegate {
    public func centralManagerDidUpdateState(_ central: CBCentralManager) {
        if central.state != .poweredOn {
            pendingRequestDeviceCall?.reject("Bluetooth is not powered on")
            pendingRequestDeviceCall = nil
            pendingConnectCall?.reject("Bluetooth is not powered on")
            pendingConnectCall = nil
        }
    }

    public func centralManager(
        _ central: CBCentralManager,
        didDiscover peripheral: CBPeripheral,
        advertisementData: [String: Any],
        rssi RSSI: NSNumber
    ) {
        peripheralsById[peripheral.identifier.uuidString] = peripheral
    }

    public func centralManager(_ central: CBCentralManager, didConnect peripheral: CBPeripheral) {
        peripheral.delegate = self
        peripheral.discoverServices([serviceUuid])
    }

    public func centralManager(
        _ central: CBCentralManager,
        didFailToConnect peripheral: CBPeripheral,
        error: Error?
    ) {
        pendingConnectCall?.reject(error?.localizedDescription ?? "Bluetooth connection failed")
        pendingConnectCall = nil
        notifyStatus(
            deviceId: peripheral.identifier.uuidString,
            status: "disconnected",
            reason: "connect-failed"
        )
    }

    public func centralManager(
        _ central: CBCentralManager,
        didDisconnectPeripheral peripheral: CBPeripheral,
        error: Error?
    ) {
        notifyStatus(
            deviceId: peripheral.identifier.uuidString,
            status: "disconnected",
            reason: error?.localizedDescription ?? "native-disconnected"
        )
    }
}

extension DMDashIOSBluetoothPlugin: CBPeripheralDelegate {
    public func peripheral(_ peripheral: CBPeripheral, didDiscoverServices error: Error?) {
        if let error {
            pendingConnectCall?.reject(error.localizedDescription)
            pendingConnectCall = nil
            return
        }
        guard let service = peripheral.services?.first(where: { $0.uuid == serviceUuid }) else {
            pendingConnectCall?.reject("Meshtastic BLE service not found")
            pendingConnectCall = nil
            return
        }
        peripheral.discoverCharacteristics([toRadioUuid, fromRadioUuid, fromNumUuid], for: service)
    }

    public func peripheral(
        _ peripheral: CBPeripheral,
        didDiscoverCharacteristicsFor service: CBService,
        error: Error?
    ) {
        if let error {
            pendingConnectCall?.reject(error.localizedDescription)
            pendingConnectCall = nil
            return
        }

        for characteristic in service.characteristics ?? [] {
            if characteristic.uuid == toRadioUuid {
                toRadioCharacteristic = characteristic
            }
            if characteristic.uuid == fromRadioUuid {
                fromRadioCharacteristic = characteristic
            }
            if characteristic.uuid == fromNumUuid {
                fromNumCharacteristic = characteristic
            }
        }

        guard let fromNumCharacteristic else {
            pendingConnectCall?.reject("Meshtastic notify characteristic not found")
            pendingConnectCall = nil
            return
        }

        peripheral.setNotifyValue(true, for: fromNumCharacteristic)
        pendingConnectCall?.resolve()
        pendingConnectCall = nil
        notifyStatus(deviceId: peripheral.identifier.uuidString, status: "connected")
        readFromRadio(peripheral)
    }

    public func peripheral(
        _ peripheral: CBPeripheral,
        didUpdateNotificationStateFor characteristic: CBCharacteristic,
        error: Error?
    ) {
        if error == nil, characteristic.uuid == fromNumUuid {
            readFromRadio(peripheral)
        }
    }

    public func peripheral(
        _ peripheral: CBPeripheral,
        didUpdateValueFor characteristic: CBCharacteristic,
        error: Error?
    ) {
        guard characteristic.uuid == fromRadioUuid else {
            return
        }
        guard error == nil, let value = characteristic.value, !value.isEmpty else {
            return
        }

        notifyListeners("packet", data: [
            "deviceId": peripheral.identifier.uuidString,
            "data": value.base64EncodedString(),
        ])
        readFromRadio(peripheral)
    }

    public func peripheral(
        _ peripheral: CBPeripheral,
        didWriteValueFor characteristic: CBCharacteristic,
        error: Error?
    ) {
        guard characteristic.uuid == toRadioUuid else {
            return
        }
        let calls = pendingWriteCalls
        pendingWriteCalls.removeAll()
        for call in calls {
            if let error {
                call.reject(error.localizedDescription)
            } else {
                call.resolve()
            }
        }
        readFromRadio(peripheral)
    }

    private func readFromRadio(_ peripheral: CBPeripheral) {
        guard let fromRadioCharacteristic else {
            return
        }
        peripheral.readValue(for: fromRadioCharacteristic)
    }
}
